import { z } from "zod";
import { diagnostics } from "../../diagnostics/src";
import type { MeshNode, MeshTransport } from "./node";
import { EnvelopeSchema, seconds, type Envelope } from "./protocol";
import { digest, sign, verify, verifyMember } from "./security";
import { fragment, Reassembler } from "./framing";
import { participation } from "./resource-policy";

export interface RadioLink {
	send(data: string): Promise<void>;
	close(): void;
	onData(callback: (data: string) => void): () => void;
}
const hello = z
	.object({
		kind: z.literal("radio-hello"),
		nonce: z.string().uuid(),
		subject: z.string().length(43),
		at: z.number().int(),
	})
	.strict();
const auth = z
	.object({
		kind: z.literal("radio-auth"),
		nonce: z.string().uuid(),
		peer_nonce: z.string().uuid(),
		subject: z.string().length(43),
		peer: z.string().length(43),
	})
	.strict();
const rpc = z.discriminatedUnion("kind", [
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
const packet = z
	.object({
		session: z.string().length(43),
		sequence: z.number().int().positive(),
		payload: rpc,
	})
	.strict();
export class AuthenticatedRadio implements MeshTransport {
	readonly kind = "bluetooth-classic-rfcomm";
	peerCredential = "";
	private nonce = crypto.randomUUID();
	private peerNonce = "";
	private peerSubject = "";
	private session = "";
	private sequence = 0;
	private received = 0;
	private authenticated = false;
	private closed = false;
	private assembly = new Reassembler();
	private inbox = Promise.resolve();
	private queuedFrames = 0;
	private outbox = Promise.resolve();
	private remove: () => void;
	private resolveReady!: () => void;
	private rejectReady!: (e: Error) => void;
	private readyPromise: Promise<void>;
	private timeout: ReturnType<typeof setTimeout>;
	private pending = new Map<
		string,
		{
			resolve: (v: { credential: string; proof: string }) => void;
			reject: (e: Error) => void;
			timer: ReturnType<typeof setTimeout>;
		}
	>();
	constructor(
		readonly node: MeshNode,
		readonly link: RadioLink,
	) {
		participation(node.policy, node.signal);
		this.readyPromise = new Promise((resolve, reject) => {
			this.resolveReady = resolve;
			this.rejectReady = reject;
		});
		void this.readyPromise.catch(() => {});
		this.remove = link.onData((data) => {
			if (this.closed) return;
			if (data.length > 13000 || this.queuedFrames >= 128) {
				void diagnostics.record("RESOURCE_LIMIT", "mesh", "receive");
				this.close();
				return;
			}
			this.queuedFrames++;
			this.inbox = this.inbox
				.then(() => {
					if (!this.closed) return this.receive(data);
				})
				.catch(() => {
					void diagnostics.record(
						this.authenticated ? "INTEGRITY_REJECTED" : "MESH_AUTH_FAILED",
						"mesh",
						"receive",
					);
					this.close();
				})
				.finally(() => {
					this.queuedFrames--;
				});
		});
		this.timeout = setTimeout(() => this.close(), 20000);
	}
	async begin() {
		await this.raw({
			credential: this.node.identity.credential,
			proof: await sign(
				{
					kind: "radio-hello",
					nonce: this.nonce,
					subject: this.node.identity.subject,
					at: seconds(),
				},
				this.node.identity.privateKey,
			),
		});
	}
	ready() {
		return this.readyPromise;
	}
	private async raw(value: unknown) {
		const frames = await fragment(value);
		for (const frame of frames) await this.link.send(frame);
	}
	private async receive(data: string) {
		participation(this.node.policy, this.node.signal);
		const message = await this.assembly.accept(data);
		if (message === null) return;
		const bundle = z
			.object({
				credential: z.string().max(3000),
				proof: z.string().max(98000),
			})
			.strict()
			.parse(message);
		const member = await verifyMember(bundle.credential, this.node.trust);
		if (member.sub === this.node.identity.subject)
			throw new Error("Sessão própria recusada.");
		// Data proofs are larger than credential proofs; separate bounded verifier below.
		const value = await verifyRadioProof(bundle.proof, member.jwk);
		if (!this.peerNonce) {
			const h = hello.parse(value);
			if (h.subject !== member.sub || Math.abs(h.at - seconds()) > 120)
				throw new Error("Identidade ou horário inválido.");
			await this.node.store.clock(seconds());
			await this.node.store.maintain(seconds());
			await this.node.store.claimSession(h.nonce, seconds() + 120, seconds());
			this.peerCredential = bundle.credential;
			this.peerNonce = h.nonce;
			this.peerSubject = member.sub;
			this.session = await digest(
				[this.nonce, this.peerNonce].sort().join(":"),
			);
			await this.raw({
				credential: this.node.identity.credential,
				proof: await sign(
					{
						kind: "radio-auth",
						nonce: this.nonce,
						peer_nonce: this.peerNonce,
						subject: this.node.identity.subject,
						peer: this.peerSubject,
					},
					this.node.identity.privateKey,
				),
			});
			return;
		}
		if (member.sub !== this.peerSubject)
			throw new Error("Participante mudou durante a sessão.");
		if (!this.authenticated) {
			const a = auth.parse(value);
			if (
				a.nonce !== this.peerNonce ||
				a.peer_nonce !== this.nonce ||
				a.subject !== this.peerSubject ||
				a.peer !== this.node.identity.subject
			)
				throw new Error("Prova de posse inválida.");
			this.authenticated = true;
			clearTimeout(this.timeout);
			this.timeout = setTimeout(() => this.close(), 300000);
			this.resolveReady();
			return;
		}
		const content = packet.parse(value);
		if (
			content.session !== this.session ||
			content.sequence !== this.received + 1
		)
			throw new Error("Replay ou ordem inválida.");
		this.received = content.sequence;
		const p = content.payload;
		if (p.kind === "response") {
			const waiting = this.pending.get(p.id);
			if (waiting) {
				clearTimeout(waiting.timer);
				this.pending.delete(p.id);
				p.error
					? waiting.reject(new Error("Pacote recusado; origem preservada."))
					: waiting.resolve(p);
			}
			return;
		}
		try {
			const result =
				p.kind === "offer"
					? await this.node.receive(p.envelope, this.peerCredential)
					: (await this.node.receiveServerReceipt(p.proof),
						{ credential: "", proof: "" });
			await this.send({ kind: "response", id: p.id, ...result, error: false });
		} catch {
			await this.send({
				kind: "response",
				id: p.id,
				credential: "",
				proof: "",
				error: true,
			});
		}
	}
	private send(payload: z.infer<typeof rpc>) {
		this.outbox = this.outbox.then(async () => {
			await this.ready();
			if (this.closed) throw new Error("Rádio encerrado.");
			const proof = await sign(
				{ session: this.session, sequence: ++this.sequence, payload },
				this.node.identity.privateKey,
			);
			await this.raw({ credential: this.node.identity.credential, proof });
		});
		return this.outbox;
	}
	private async request(
		value:
			| { kind: "offer"; envelope: Envelope }
			| { kind: "receipt"; proof: string },
	) {
		if (this.pending.size >= 1) throw new Error("Transferência em andamento.");
		await this.ready();
		const id = crypto.randomUUID();
		const response = new Promise<{ credential: string; proof: string }>(
			(resolve, reject) => {
				const timer = setTimeout(() => {
					this.pending.delete(id);
					reject(new Error("ACK não chegou; mensagem preservada."));
				}, 15000);
				this.pending.set(id, { resolve, reject, timer });
			},
		);
		void response.catch(() => {});
		try {
			await this.send({ ...value, id });
			return await response;
		} catch (e) {
			this.close();
			throw e;
		}
	}
	offer(envelope: Envelope) {
		return this.request({ kind: "offer", envelope });
	}
	async deliverReceipt(proof: string) {
		await this.request({ kind: "receipt", proof });
	}
	close() {
		if (this.closed) return;
		this.closed = true;
		clearTimeout(this.timeout);
		this.remove();
		this.link.close();
		this.assembly.clear();
		this.rejectReady(
			new Error("Autenticação ou conexão Bluetooth não concluída."),
		);
		for (const p of this.pending.values()) {
			clearTimeout(p.timer);
			p.reject(new Error("Rádio encerrado; cópia preservada."));
		}
		this.pending.clear();
	}
}
// Standard JWS verification, with a separate cap for an enveloped data packet.
import { compactVerify, importJWK, type JWK } from "jose";
async function verifyRadioProof(value: string, jwk: JsonWebKey) {
	if (value.length <= 20000) return verify(value, jwk);
	if (value.length > 98000) throw new Error("Prova excedida.");
	const result = await compactVerify(
		value,
		await importJWK(jwk as JWK, "ES256"),
		{ algorithms: ["ES256"] },
	);
	if (result.protectedHeader.typ !== "mesh+jws")
		throw new Error("Tipo inválido.");
	return JSON.parse(
		new TextDecoder("utf-8", { fatal: true }).decode(result.payload),
	) as unknown;
}
