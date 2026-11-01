import { z } from "zod";
import type { MeshNode, MeshTransport } from "./node";
import { EnvelopeSchema, seconds, type Envelope } from "./protocol";
import { participation } from "./resource-policy";
import { digest, sign, verify, verifyMember } from "./security";
import { fragment, Reassembler } from "./framing";

const signalSchema = z
	.object({
		kind: z.literal("mesh-session"),
		id: z.string().uuid(),
		at: z.number().int(),
		expires: z.number().int(),
		type: z.enum(["offer", "answer"]),
		sdp: z.string().max(10000),
		reply: z.string().max(43),
	})
	.strict();
const packetSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("offer"),
			id: z.string().uuid(),
			envelope: EnvelopeSchema,
		})
		.strict(),
	z
		.object({
			kind: z.literal("receipt"),
			id: z.string().uuid(),
			proof: z.string().max(3000),
		})
		.strict(),
	z
		.object({
			kind: z.literal("response"),
			id: z.string().uuid(),
			credential: z.string().max(3000),
			proof: z.string().max(3000),
			error: z.boolean(),
		})
		.strict(),
]);
type Bundle = { credential: string; proof: string };

export class ManualWebRTC implements MeshTransport {
	readonly kind = "webrtc-manual";
	peerCredential = "";
	private pc: RTCPeerConnection;
	private channel: RTCDataChannel | null = null;
	private offerHash = "";
	private assembly = new Reassembler();
	private pending = new Map<
		string,
		{
			resolve: (v: { credential: string; proof: string }) => void;
			reject: (e: Error) => void;
			timer: ReturnType<typeof setTimeout>;
		}
	>();
	private inbox = Promise.resolve();
	private opened: Promise<void>;
	private resolveOpen!: () => void;
	private rejectOpen!: (e: Error) => void;
	private expiry: ReturnType<typeof setTimeout>;
	constructor(readonly node: MeshNode) {
		participation(node.policy, node.signal);
		this.pc = new RTCPeerConnection({
			iceServers: [],
			iceCandidatePoolSize: 0,
		});
		this.opened = new Promise((resolve, reject) => {
			this.resolveOpen = resolve;
			this.rejectOpen = reject;
		});
		void this.opened.catch(() => {});
		this.expiry = setTimeout(() => this.close(), 120000);
		this.pc.ondatachannel = (e) => this.bind(e.channel);
		this.pc.onconnectionstatechange = () => {
			if (["failed", "closed"].includes(this.pc.connectionState)) this.close();
		};
	}
	private bind(channel: RTCDataChannel) {
		if (this.channel) {
			channel.close();
			return;
		}
		this.channel = channel;
		channel.onopen = () => {
			clearTimeout(this.expiry);
			this.expiry = setTimeout(() => this.close(), 300000);
			this.resolveOpen();
		};
		channel.onclose = () => this.close();
		channel.onmessage = (e) => {
			this.inbox = this.inbox
				.then(async () => {
					const raw = await this.assembly.accept(e.data);
					if (raw === null) return;
					const packet = packetSchema.parse(raw);
					if (packet.kind === "response") {
						const p = this.pending.get(packet.id);
						if (p) {
							clearTimeout(p.timer);
							this.pending.delete(packet.id);
							packet.error
								? p.reject(
										new Error(
											"Participante recusou o pacote; cópia local preservada.",
										),
									)
								: p.resolve(packet);
						}
						return;
					}
					participation(this.node.policy, this.node.signal);
					try {
						const response =
							packet.kind === "offer"
								? await this.node.receive(packet.envelope, this.peerCredential)
								: (await this.node.receiveServerReceipt(packet.proof),
									{ credential: "", proof: "" });
						await this.send({
							kind: "response",
							id: packet.id,
							...response,
							error: false,
						});
					} catch {
						await this.send({
							kind: "response",
							id: packet.id,
							credential: "",
							proof: "",
							error: true,
						});
					}
				})
				.catch(() => this.close());
		};
	}
	private async gathered() {
		if (this.pc.iceGatheringState === "complete") return;
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pc.removeEventListener("icegatheringstatechange", check);
				reject(new Error("Coleta local de conexão expirou."));
			}, 10000);
			const check = () => {
				if (this.pc.iceGatheringState === "complete") {
					clearTimeout(timer);
					this.pc.removeEventListener("icegatheringstatechange", check);
					resolve();
				}
			};
			this.pc.addEventListener("icegatheringstatechange", check);
			check();
		});
	}
	private async bundle(type: "offer" | "answer", reply = "") {
		await this.gathered();
		const at = seconds(),
			proof = await sign(
				signalSchema.parse({
					kind: "mesh-session",
					id: crypto.randomUUID(),
					at,
					expires: at + 120,
					type,
					sdp: this.pc.localDescription!.sdp,
					reply,
				}),
				this.node.identity.privateKey,
			);
		return JSON.stringify({ credential: this.node.identity.credential, proof });
	}
	private async parse(raw: string, type: "offer" | "answer") {
		if (raw.length > 24000)
			throw new Error("Convite de conexão excede o limite.");
		const bundle = z
			.object({
				credential: z.string().max(3000),
				proof: z.string().max(20000),
			})
			.strict()
			.parse(JSON.parse(raw)) as Bundle;
		const member = await verifyMember(bundle.credential, this.node.trust),
			claim = signalSchema.parse(await verify(bundle.proof, member.jwk));
		if (
			member.sub === this.node.identity.subject ||
			claim.type !== type ||
			claim.at > seconds() + 30 ||
			claim.expires - claim.at !== 120 ||
			claim.expires <= seconds() ||
			(type === "offer" && claim.reply !== "") ||
			(type === "answer" && claim.reply !== this.offerHash)
		)
			throw new Error("Sessão inválida, incompatível ou expirada.");
		await this.node.store.maintain(seconds());
		await this.node.store.clock(seconds());
		await this.node.store.claimSession(claim.id, claim.expires, seconds());
		this.peerCredential = bundle.credential;
		return claim;
	}
	async createOffer() {
		this.bind(this.pc.createDataChannel("mesh-v1", { ordered: true }));
		await this.pc.setLocalDescription(await this.pc.createOffer());
		const value = await this.bundle("offer");
		this.offerHash = await digest(value);
		return value;
	}
	async acceptOffer(raw: string) {
		const claim = await this.parse(raw, "offer");
		await this.pc.setRemoteDescription({ type: "offer", sdp: claim.sdp });
		await this.pc.setLocalDescription(await this.pc.createAnswer());
		return this.bundle("answer", await digest(raw));
	}
	async acceptAnswer(raw: string) {
		const claim = await this.parse(raw, "answer");
		await this.pc.setRemoteDescription({ type: "answer", sdp: claim.sdp });
		await this.ready();
	}
	async ready() {
		await this.opened;
		if (!this.peerCredential) throw new Error("Participante não autenticado.");
	}
	private async send(value: unknown) {
		await this.ready();
		if (
			!this.channel ||
			this.channel.readyState !== "open" ||
			this.channel.bufferedAmount > 131072
		)
			throw new Error("Canal indisponível ou ocupado.");
		for (const part of await fragment(value)) this.channel.send(part);
	}
	private async request(
		value:
			| { kind: "offer"; envelope: Envelope }
			| { kind: "receipt"; proof: string },
	) {
		if (this.pending.size >= 2)
			throw new Error("Limite de solicitações simultâneas.");
		const id = crypto.randomUUID();
		const response = new Promise<{ credential: string; proof: string }>(
			(resolve, reject) => {
				const timer = setTimeout(() => {
					this.pending.delete(id);
					reject(new Error("Recibo não chegou; cópia local preservada."));
				}, 15000);
				this.pending.set(id, { resolve, reject, timer });
			},
		);
		void response.catch(() => {});
		try {
			await this.send({ ...value, id });
			return await response;
		} catch (error) {
			const p = this.pending.get(id);
			if (p) {
				clearTimeout(p.timer);
				this.pending.delete(id);
				p.reject(new Error("Falha no canal."));
			}
			throw error;
		}
	}
	offer(envelope: Envelope) {
		return this.request({ kind: "offer", envelope });
	}
	async deliverReceipt(proof: string) {
		await this.request({ kind: "receipt", proof });
	}
	close() {
		clearTimeout(this.expiry);
		this.rejectOpen(new Error("Sessão encerrada."));
		this.pc.onconnectionstatechange = null;
		this.pc.ondatachannel = null;
		if (this.channel) {
			this.channel.onclose = null;
			this.channel.onmessage = null;
			this.channel.close();
		}
		this.pc.close();
		this.assembly.clear();
		for (const p of this.pending.values()) {
			clearTimeout(p.timer);
			p.reject(new Error("Sessão encerrada."));
		}
		this.pending.clear();
	}
}
