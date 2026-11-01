import "fake-indexeddb/auto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { compactDecrypt, exportJWK, generateKeyPair } from "jose";
import { IncidentSchema } from "../../packages/contracts/src";
import {
	MeshNode,
	type MeshTransport,
} from "../../packages/mesh-core/src/node";
import { MeshStore } from "../../packages/mesh-core/src/storage";
import {
	appendHop,
	createIdentity,
	digest,
	sealIncident,
	sign,
	verify,
	verifyEnvelope,
	verifyMember,
} from "../../packages/mesh-core/src/security";
import {
	defaultPolicy,
	internetAllowed,
	ConcurrencyGate,
} from "../../packages/mesh-core/src/resource-policy";
import { fragment, Reassembler } from "../../packages/mesh-core/src/framing";
import type { Trust } from "../../packages/mesh-core/src/protocol";

const now = 1800000000,
	stores: MeshStore[] = [];
let root: CryptoKey, decryptKey: CryptoKey, trust: Trust;
const incident = () =>
	IncidentSchema.parse({
		schema_version: 1,
		incident_id: crypto.randomUUID(),
		created_at: new Date(now * 1000).toISOString(),
		updated_at: new Date(now * 1000).toISOString(),
		record_type: "help",
		description: "Pessoa fictícia precisa de água na Rua Exemplo 12",
		synthetic: true,
	});
beforeAll(async () => {
	const signing = await generateKeyPair("ES256"),
		encryption = await generateKeyPair("RSA-OAEP-256", { modulusLength: 2048 });
	root = signing.privateKey;
	decryptKey = encryption.privateKey;
	trust = {
		authority_id: "test-root",
		signing_jwk: await exportJWK(signing.publicKey),
		encryption_jwk: await exportJWK(encryption.publicKey),
		revoked: [],
	};
});
async function node(name = crypto.randomUUID()) {
	const identity = await createIdentity();
	identity.credential = await sign(
		{
			aud: "mesh-member-v1",
			sub: identity.subject,
			jwk: identity.publicJwk,
			iat: now,
			nbf: now,
			exp: now + 86400,
			role: "participant",
		},
		root,
	);
	const store = new MeshStore(name);
	stores.push(store);
	await store.set("identity", identity);
	const n = new MeshNode(store, identity, trust, () => now);
	n.policy = { ...defaultPolicy, enabled: true };
	return n;
}
function link(sender: MeshNode, receiver: MeshNode): MeshTransport {
	return {
		kind: "memory-test-only",
		peerCredential: receiver.identity.credential,
		offer: (e) => receiver.receive(e, sender.identity.credential),
		deliverReceipt: (p) => receiver.receiveServerReceipt(p),
		close() {},
	};
}
afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(stores.splice(0).map((s) => s.close()));
});

describe("mesh cryptography and persistence", () => {
	it("seals exact original for central; intermediaries have no decryption key", async () => {
		const a = await node(),
			i = incident(),
			row = await a.queueOwn(i, "a".repeat(64));
		expect(JSON.stringify(row.envelope)).not.toContain(i.description);
		expect(JSON.stringify(row.envelope)).not.toContain(i.incident_id);
		const opened = await compactDecrypt(row.envelope.sealed, decryptKey);
		expect(JSON.parse(new TextDecoder().decode(opened.plaintext))).toEqual({
			incident: i,
			write_key: "a".repeat(64),
		});
		await expect(
			compactDecrypt(row.envelope.sealed, a.identity.privateKey),
		).rejects.toThrow();
		await expect(
			crypto.subtle.exportKey("jwk", a.identity.privateKey),
		).rejects.toThrow();
	});
	it("A→B restart→C, receipt goes C→B→A only on later encounters", async () => {
		const a = await node(),
			b = await node(),
			c = await node(),
			i = incident(),
			row = await a.queueOwn(i, "b".repeat(64));
		const arrived = vi.fn();
		a.onServerDelivery = arrived;
		await a.forward(link(a, b));
		expect(await b.store.rows()).toHaveLength(1);
		expect(arrived).not.toHaveBeenCalled();
		const savedIdentity = await b.store.identity();
		expect(savedIdentity!.privateKey.extractable).toBe(false);
		const restarted = new MeshNode(b.store, savedIdentity!, trust, () => now);
		restarted.policy = { ...b.policy };
		await restarted.forward(link(restarted, c));
		expect((await c.store.rows())[0].envelope.hops).toHaveLength(2);
		c.signal = { network: "wifi", batteryPercent: 80 };
		await c.gateway(async (env) =>
			sign(
				{
					kind: "mesh-server-receipt",
					message_id: row.messageId,
					origin_hash: await digest(env.origin_proof),
					receipt_id: crypto.randomUUID(),
					server_received_at: new Date(now * 1000).toISOString(),
					status: "RECEBIDO_PELO_SERVIDOR",
				},
				root,
			),
		);
		expect(arrived).not.toHaveBeenCalled();
		await c.forward(link(c, restarted));
		expect(arrived).not.toHaveBeenCalled();
		await restarted.forward(link(restarted, a));
		expect(arrived).toHaveBeenCalledOnce();
		expect((await a.store.get(row.messageId))?.serverReceipt).toBeTruthy();
	});
	it("reopens a durable store and CryptoKey after closing the database", async () => {
		const name = crypto.randomUUID(),
			a = await node(name),
			row = await a.queueOwn(incident(), "a".repeat(64));
		await a.store.close();
		const reopened = new MeshStore(name);
		stores.push(reopened);
		expect((await reopened.get(row.messageId))?.envelope).toEqual(row.envelope);
		const identity = await reopened.identity();
		expect(
			await verify(
				await sign({ probe: true }, identity!.privateKey),
				identity!.publicJwk,
			),
		).toEqual({ probe: true });
	});
	it("never acknowledges a failed durable write", async () => {
		const a = await node(),
			b = await node(),
			row = await a.queueOwn(incident(), "a".repeat(64));
		vi.spyOn(b.store, "accept").mockRejectedValueOnce(new Error("Disk full"));
		await expect(a.forward(link(a, b))).rejects.toThrow("Disk full");
		expect((await a.store.get(row.messageId))?.nodeReceipts).toEqual([]);
		expect(await b.store.rows()).toHaveLength(0);
		expect(await a.store.rows()).toHaveLength(1);
	});
	it("retries applying a durable central receipt after an interrupted origin update", async () => {
		const a = await node(),
			row = await a.queueOwn(incident(), "a".repeat(64));
		const proof = await sign(
			{
				kind: "mesh-server-receipt",
				message_id: row.messageId,
				origin_hash: row.originHash,
				receipt_id: crypto.randomUUID(),
				server_received_at: new Date(now * 1000).toISOString(),
				status: "RECEBIDO_PELO_SERVIDOR",
			},
			root,
		);
		const callback = vi
			.fn()
			.mockRejectedValueOnce(new Error("Origin database busy"))
			.mockResolvedValueOnce(undefined);
		a.onServerDelivery = callback;
		await expect(a.receiveServerReceipt(proof)).rejects.toThrow("busy");
		expect((await a.store.get(row.messageId))?.serverReceipt).toBe(proof);
		await a.receiveServerReceipt(proof);
		expect(callback).toHaveBeenCalledTimes(2);
	});
	it("deduplicates repeated transmissions without conflating independent incidents", async () => {
		const a = await node(),
			b = await node(),
			row = await a.queueOwn(incident(), "a".repeat(64)),
			e = await appendHop(
				row.envelope,
				a.identity,
				b.identity.credential,
				trust,
				now,
			);
		await b.receive(e, a.identity.credential);
		await b.receive(e, a.identity.credential);
		expect(await b.store.rows()).toHaveLength(1);
		expect((await b.store.metrics()).duplicates).toBe(1);
		await a.queueOwn(incident(), "a".repeat(64));
		expect(await a.store.rows()).toHaveLength(2);
	});
	it("rejects altered ciphertext, proof, credentials and revoked members", async () => {
		const a = await node(),
			row = await a.queueOwn(incident(), "a".repeat(64));
		await expect(
			verifyEnvelope(
				{ ...row.envelope, sealed: row.envelope.sealed + "x" },
				trust,
				now,
			),
		).rejects.toThrow();
		await expect(
			verifyEnvelope(
				{
					...row.envelope,
					origin_proof: row.envelope.origin_proof.slice(0, -20) + "INVALID",
				},
				trust,
				now,
			),
		).rejects.toThrow();
		await expect(
			verifyMember(
				a.identity.credential,
				{ ...trust, revoked: [a.identity.subject] },
				now,
			),
		).rejects.toThrow();
		await expect(
			verifyMember(a.identity.credential, trust, now + 86401),
		).rejects.toThrow();
	});
	it("rejects loops, routes beyond max hops, expired envelopes and changed identifiers", async () => {
		const a = await node(),
			b = await node(),
			c = await node(),
			env = await sealIncident(
				incident(),
				"a".repeat(64),
				a.identity,
				trust,
				now,
				1,
			);
		const hop = await appendHop(
			env,
			a.identity,
			b.identity.credential,
			trust,
			now,
		);
		await expect(
			appendHop(hop, b.identity, a.identity.credential, trust, now),
		).rejects.toThrow();
		await expect(
			appendHop(hop, b.identity, c.identity.credential, trust, now),
		).rejects.toThrow();
		await expect(verifyEnvelope(env, trust, now + 43201)).rejects.toThrow();
		const checked = await verifyEnvelope(hop, trust, now);
		await b.store.accept(checked, b.policy, now);
		await expect(
			b.store.accept({ ...checked, originHash: "x".repeat(43) }, b.policy, now),
		).rejects.toThrow("Identificador");
	});
	it("rejects a forged server receipt and mismatched intermediary ACK", async () => {
		const a = await node(),
			b = await node(),
			row = await a.queueOwn(incident(), "a".repeat(64));
		await expect(
			a.receiveServerReceipt(
				await sign({ anything: true }, b.identity.privateKey),
			),
		).rejects.toThrow();
		const wire = link(a, b);
		wire.offer = async () => ({
			credential: b.identity.credential,
			proof: await sign(
				{
					kind: "mesh-node-receipt",
					message_id: row.messageId,
					origin_hash: row.originHash,
					transmission_id: crypto.randomUUID(),
					receiver: b.identity.subject,
					stored_at: now,
					status: "RECEBIDO_POR_INTERMEDIARIO",
				},
				b.identity.privateKey,
			),
		});
		await expect(a.forward(wire)).rejects.toThrow("Recibo");
		expect((await a.store.get(row.messageId))?.serverReceipt).toBeNull();
	});
});
describe("mesh limits and safe defaults", () => {
	it("default off, unknown or cellular internet blocked unless explicitly enabled", () => {
		expect(defaultPolicy.enabled).toBe(false);
		for (const network of ["unknown", "cellular", "offline"] as const)
			expect(() =>
				internetAllowed(
					{ ...defaultPolicy, enabled: true },
					{ network, batteryPercent: null },
				),
			).toThrow();
		expect(() =>
			internetAllowed(
				{ ...defaultPolicy, enabled: true, allowMobile: true },
				{ network: "cellular", batteryPercent: 50 },
			),
		).not.toThrow();
	});
	it("pause, disabling and low battery preserve queued messages", async () => {
		const a = await node(),
			b = await node();
		await a.queueOwn(incident(), "a".repeat(64));
		a.policy.paused = true;
		await expect(a.forward(link(a, b))).rejects.toThrow();
		a.policy.paused = false;
		a.signal.batteryPercent = 5;
		await expect(a.forward(link(a, b))).rejects.toThrow("bateria");
		a.signal.batteryPercent = 80;
		a.policy.enabled = false;
		await expect(a.forward(link(a, b))).rejects.toThrow();
		expect(await a.store.rows()).toHaveLength(1);
	});
	it("quota refuses relays without deleting own data; expiry removes only relay copies", async () => {
		const a = await node(),
			b = await node();
		b.policy.maxMessages = 1;
		await b.queueOwn(incident(), "b".repeat(64));
		await a.queueOwn(incident(), "a".repeat(64));
		await a.forward(link(a, b));
		await a.queueOwn(incident(), "a".repeat(64));
		await expect(a.forward(link(a, b))).rejects.toThrow("Cota");
		await b.store.maintain(now + 50000);
		const remaining = await b.store.rows();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].ownIncidentId).toBeTruthy();
	});
	it("daily quota and backoff survive restart; no retry flood", async () => {
		const a = await node();
		a.signal.network = "wifi";
		await a.queueOwn(incident(), "a".repeat(64));
		const send = vi.fn().mockRejectedValue(new Error("503"));
		await expect(a.gateway(send)).rejects.toThrow("503");
		await a.gateway(send);
		expect(send).toHaveBeenCalledOnce();
		await a.store.reserveInternet(
			a.policy.dailyInternetBytes - 20000,
			a.policy,
			now,
		);
		await expect(a.store.reserveInternet(30000, a.policy, now)).rejects.toThrow(
			"Cota",
		);
		expect((await a.store.rows())[0].nextAttempt).toBeGreaterThan(now);
	});
	it("fanout caps prevent flooding and independent concurrency gate rejects overlap", async () => {
		const a = await node(),
			b = await node(),
			c = await node(),
			d = await node();
		await a.queueOwn(incident(), "a".repeat(64));
		await a.forward(link(a, b));
		await a.forward(link(a, c));
		await a.forward(link(a, d));
		expect(await d.store.rows()).toHaveLength(0);
		const gate = new ConcurrencyGate();
		let resolve!: () => void;
		const pending = gate.run(
			() =>
				new Promise<void>((r) => {
					resolve = r;
				}),
		);
		await expect(gate.run(async () => {})).rejects.toThrow();
		resolve();
		await pending;
	});
	it("clock rollback and replayed or expired sessions fail closed", async () => {
		const a = await node();
		await a.store.clock(now);
		await expect(a.store.clock(now - 301)).rejects.toThrow("Relógio");
		const id = crypto.randomUUID();
		await a.store.claimSession(id, now + 120, now);
		await expect(a.store.claimSession(id, now + 120, now)).rejects.toThrow(
			"utilizada",
		);
		await expect(
			a.store.claimSession(crypto.randomUUID(), now - 1, now),
		).rejects.toThrow("expirada");
	});
});
describe("bounded fragmentation", () => {
	it("reassembles out of order and identical duplicate fragments", async () => {
		const value = { text: "água 🌊".repeat(1800) },
			frames = await fragment(value),
			assembly = new Reassembler();
		expect(await assembly.accept(frames[0])).toBeNull();
		expect(await assembly.accept(frames[0])).toBeNull();
		let result: unknown;
		for (const frame of frames.slice(1).reverse())
			result = await assembly.accept(frame);
		expect(result).toEqual(value);
	});
	it("rejects corrupt/conflicting fragments and expires incomplete assemblies", async () => {
		let clock = 0;
		const a = new Reassembler(() => clock),
			frames = await fragment({ text: "x".repeat(6000) });
		await a.accept(frames[0]);
		const altered = JSON.parse(frames[0]);
		altered.data += "z";
		await expect(a.accept(JSON.stringify(altered))).rejects.toThrow();
		await a.accept(frames[0]);
		clock = 11000;
		expect(a.size).toBe(0);
		const b = new Reassembler();
		for (let i = 0; i < 2; i++)
			await b.accept((await fragment({ text: "z".repeat(3000) }))[0]);
		await expect(
			b.accept((await fragment({ text: "z".repeat(3000) }))[0]),
		).rejects.toThrow("Limite");
		await expect(fragment({ text: "x".repeat(80000) })).rejects.toThrow(
			"limite",
		);
	});
});
