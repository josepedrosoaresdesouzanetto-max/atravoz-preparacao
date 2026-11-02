import { diagnostics } from "../../diagnostics/src";
import type { Incident } from "../../contracts/src";
import {
	HopClaims,
	NodeReceiptClaims,
	seconds,
	type Envelope,
	type Identity,
	type Trust,
	type ServerDelivery,
} from "./protocol";
import {
	appendHop,
	sealIncident,
	sign,
	verify,
	verifyEnvelope,
	verifyMember,
	verifyServerReceipt,
} from "./security";
import { MeshStore } from "./storage";
import {
	defaultPolicy,
	participation,
	internetAllowed,
	ConcurrencyGate,
	type ResourcePolicy,
	type ResourceSignal,
} from "./resource-policy";

export interface MeshTransport {
	readonly kind: string;
	readonly peerCredential: string;
	offer(envelope: Envelope): Promise<{ credential: string; proof: string }>;
	deliverReceipt(proof: string): Promise<void>;
	close(): void;
}
export class MeshNode {
	private gate: ConcurrencyGate;
	onChange: (() => Promise<void>) | null = null;
	policy: ResourcePolicy = { ...defaultPolicy };
	signal: ResourceSignal = { network: "unknown", batteryPercent: null };
	onServerDelivery:
		| ((id: string, receipt: ServerDelivery) => Promise<void>)
		| null = null;
	constructor(
		readonly store: MeshStore,
		readonly identity: Identity,
		public trust: Trust,
		readonly now = seconds,
	) {
		this.gate = new ConcurrencyGate(store.name);
	}
	async queueOwn(incident: Incident, writeKey: string) {
		participation(this.policy, this.signal);
		await this.store.clock(this.now());
		const old = (await this.store.rows()).find(
			(r) => r.ownIncidentId === incident.incident_id,
		);
		if (old && old.expires > this.now()) return old;
		const env = await sealIncident(
			incident,
			writeKey,
			this.identity,
			this.trust,
			this.now(),
		).catch((error) => {
			void diagnostics.record("CRYPTO_FAILED", "mesh", "save");
			throw error;
		});
		return (
			await this.store.accept(
				await verifyEnvelope(env, this.trust, this.now()),
				this.policy,
				this.now(),
				incident.incident_id,
			)
		).row;
	}
	async receive(envelope: Envelope, peerCredential: string) {
		participation(this.policy, this.signal);
		await this.store.clock(this.now());
		await this.store.maintain(this.now());
		const peer = await verifyMember(peerCredential, this.trust, this.now()),
			checked = await verifyEnvelope(envelope, this.trust, this.now());
		if (!envelope.hops.length || checked.holder !== this.identity.subject)
			throw new Error("Envelope não endereçado a esta instalação.");
		const last = envelope.hops.at(-1)!,
			sender = await verifyMember(last.credential, this.trust, this.now());
		if (sender.sub !== peer.sub)
			throw new Error("Sessão e remetente não correspondem.");
		const hop = HopClaims.parse(await verify(last.proof, sender.jwk));
		const result = await this.store.accept(checked, this.policy, this.now());
		if (result.duplicate)
			void diagnostics.record("DUPLICATE_AVOIDED", "mesh", "receive", {
				result: "success",
			});
		await this.store.metric(
			result.duplicate
				? { duplicates: 1 }
				: { received: 1, hopsReceived: envelope.hops.length },
		);
		const proof = await sign(
			NodeReceiptClaims.parse({
				kind: "mesh-node-receipt",
				message_id: checked.origin.message_id,
				origin_hash: checked.originHash,
				transmission_id: hop.transmission_id,
				receiver: this.identity.subject,
				stored_at: this.now(),
				status: "RECEBIDO_POR_INTERMEDIARIO",
			}),
			this.identity.privateKey,
		);
		await this.onChange?.().catch(() => {});
		return { credential: this.identity.credential, proof };
	}
	async forward(transport: MeshTransport) {
		return this.gate.run(async () => {
			participation(this.policy, this.signal);
			await this.store.clock(this.now());
			const peer = await verifyMember(
				transport.peerCredential,
				this.trust,
				this.now(),
			);
			for (const receipt of (await this.store.receipts()).slice(
				0,
				this.policy.perEncounter,
			)) {
				participation(this.policy, this.signal);
				await transport.deliverReceipt(receipt.proof);
			}
			const rows = (await this.store.rows())
				.filter(
					(r) =>
						!r.serverReceipt &&
						r.expires > this.now() &&
						r.nextAttempt <= this.now() &&
						r.attempts < this.policy.maxAttempts &&
						r.forwarded.length < this.policy.maxCopies &&
						!r.forwarded.includes(peer.sub),
				)
				.sort((a, b) => Number(!!b.ownIncidentId) - Number(!!a.ownIncidentId))
				.slice(0, this.policy.perEncounter);
			for (const row of rows) {
				participation(this.policy, this.signal);
				const verified = await verifyEnvelope(
					row.envelope,
					this.trust,
					this.now(),
				);
				if (
					verified.visited.includes(peer.sub) ||
					row.envelope.hops.length >= verified.origin.max_hops
				)
					continue;
				const envelope = await appendHop(
					row.envelope,
					this.identity,
					transport.peerCredential,
					this.trust,
					this.now(),
				);
				await this.store.update(row.messageId, (r) => {
					r.attempts++;
					r.nextAttempt = this.now() + Math.min(300, 5 * 2 ** r.attempts);
				});
				await this.store.metric({ attempts: 1 });
				try {
					const ack = await transport.offer(envelope),
						member = await verifyMember(ack.credential, this.trust, this.now()),
						receipt = NodeReceiptClaims.parse(
							await verify(ack.proof, member.jwk),
						);
					const hop = HopClaims.parse(
						await verify(
							envelope.hops.at(-1)!.proof,
							(
								await verifyMember(
									this.identity.credential,
									this.trust,
									this.now(),
								)
							).jwk,
						),
					);
					if (
						member.sub !== peer.sub ||
						receipt.receiver !== peer.sub ||
						receipt.origin_hash !== row.originHash ||
						receipt.message_id !== row.messageId ||
						receipt.transmission_id !== hop.transmission_id
					)
						throw new Error("Recibo intermediário incompatível.");
					await this.store.update(row.messageId, (r) => {
						r.forwarded.push(peer.sub);
						r.nodeReceipts.push(ack.proof);
						r.nextAttempt = 0;
					});
					await this.store.metric({
						forwarded: 1,
						bytesSent: new TextEncoder().encode(JSON.stringify(envelope))
							.length,
					});
				} catch (error) {
					await this.store.metric({ failures: 1 });
					void diagnostics.record("MESH_TRANSFER_FAILED", "mesh", "send", {
						recovery: "queued",
					});
					throw error;
				}
			}
		});
	}
	async receiveServerReceipt(proof: string) {
		const receipt = await verifyServerReceipt(proof, this.trust),
			row = await this.store.get(receipt.message_id);
		if (row && row.originHash !== receipt.origin_hash)
			throw new Error("Recibo de conteúdo diferente.");
		if (!row) return; // Unknown receipts never create cache entries.
		if (row.serverReceipt === proof) {
			if (row.ownIncidentId && this.onServerDelivery)
				await this.onServerDelivery(row.ownIncidentId, receipt);
			return;
		}
		await this.store.receipt(row.messageId, proof, this.now() + 86400);
		await this.store.update(row.messageId, (r) => {
			r.serverReceipt = proof;
		});
		await this.store.metric({
			retentionSeconds: Math.max(0, this.now() - row.storedAt),
		});
		if (row.ownIncidentId && this.onServerDelivery)
			await this.onServerDelivery(row.ownIncidentId, receipt);
		await this.onChange?.().catch(() => {});
	}
	async gateway(
		send: (
			envelope: Envelope,
			credential: string,
			proof: string,
		) => Promise<string>,
	) {
		return this.gate.run(async () => {
			internetAllowed(this.policy, this.signal);
			await this.store.clock(this.now());
			await this.store.maintain(this.now());
			const rows = (await this.store.rows())
				.filter(
					(r) =>
						!r.serverReceipt &&
						r.expires > this.now() &&
						r.nextAttempt <= this.now() &&
						r.attempts < this.policy.maxAttempts,
				)
				.sort((a, b) => Number(!!b.ownIncidentId) - Number(!!a.ownIncidentId))
				.slice(0, this.policy.perEncounter);
			for (const row of rows) {
				internetAllowed(this.policy, this.signal);
				await this.store.reserveInternet(
					row.bytes + 8192,
					this.policy,
					this.now(),
				);
				const proof = await sign(
					{
						kind: "mesh-gateway",
						message_id: row.messageId,
						origin_hash: row.originHash,
						at: this.now(),
						nonce: crypto.randomUUID(),
					},
					this.identity.privateKey,
				);
				await this.store.update(row.messageId, (r) => {
					r.attempts++;
					r.nextAttempt = this.now() + Math.min(300, 5 * 2 ** r.attempts);
				});
				await this.store.metric({ attempts: 1 });
				try {
					await this.receiveServerReceipt(
						await send(row.envelope, this.identity.credential, proof),
					);
					await this.store.metric({ bytesSent: row.bytes });
				} catch (error) {
					await this.store.metric({ failures: 1 });
					void diagnostics.record("MESH_TRANSFER_FAILED", "mesh", "send", {
						recovery: "queued",
					});
					throw error;
				}
			}
		});
	}
}
