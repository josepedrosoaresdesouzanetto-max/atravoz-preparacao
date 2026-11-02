import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import {
	AuthenticatedRadio,
	type RadioLink,
} from "../../packages/mesh-core/src/proximity";
import { MeshNode } from "../../packages/mesh-core/src/node";
import { MeshStore } from "../../packages/mesh-core/src/storage";
import { createIdentity, sign } from "../../packages/mesh-core/src/security";
import { seconds, type Trust } from "../../packages/mesh-core/src/protocol";
import { defaultPolicy } from "../../packages/mesh-core/src/resource-policy";
import { IncidentSchema } from "../../packages/contracts/src";
const stores: MeshStore[] = [],
	transports: AuthenticatedRadio[] = [];
async function pair() {
	const root = await generateKeyPair("ES256"),
		enc = await generateKeyPair("RSA-OAEP-256", { modulusLength: 2048 });
	const trust: Trust = {
		authority_id: "test-authority",
		signing_jwk: await exportJWK(root.publicKey),
		encryption_jwk: await exportJWK(enc.publicKey),
		revoked: [],
	};
	const nodes = await Promise.all(
		[0, 1].map(async () => {
			const identity = await createIdentity(),
				now = seconds();
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
				root.privateKey,
			);
			const store = new MeshStore(crypto.randomUUID());
			stores.push(store);
			const n = new MeshNode(store, identity, trust);
			n.policy = { ...defaultPolicy, enabled: true };
			return n;
		}),
	);
	return nodes as [MeshNode, MeshNode];
}
function wires() {
	let a: ((v: string) => void) | null = null,
		b: ((v: string) => void) | null = null;
	const one: RadioLink = {
			send: async (v) => {
				queueMicrotask(() => b?.(v));
			},
			close() {},
			onData: (fn) => {
				a = fn;
				return () => {
					a = null;
				};
			},
		},
		two: RadioLink = {
			send: async (v) => {
				queueMicrotask(() => a?.(v));
			},
			close() {},
			onData: (fn) => {
				b = fn;
				return () => {
					b = null;
				};
			},
		};
	return [one, two] as const;
}
afterEach(async () => {
	transports.splice(0).forEach((t) => t.close());
	await Promise.all(stores.splice(0).map((s) => s.close()));
});
it("native adapter protocol mutually authenticates and commits the unchanged encrypted envelope (software wire, no radio)", async () => {
	const [a, b] = await pair(),
		[one, two] = wires(),
		ta = new AuthenticatedRadio(a, one),
		tb = new AuthenticatedRadio(b, two);
	transports.push(ta, tb);
	await Promise.all([ta.begin(), tb.begin()]);
	await Promise.all([ta.ready(), tb.ready()]);
	const now = new Date().toISOString();
	const i = IncidentSchema.parse({
		schema_version: 1,
		incident_id: crypto.randomUUID(),
		created_at: now,
		updated_at: now,
		record_type: "help",
		description: "FICTÍCIO água subindo",
		synthetic: true,
	});
	const row = await a.queueOwn(i, "a".repeat(64));
	await a.forward(ta);
	expect((await b.store.get(row.messageId))?.envelope.sealed).toBe(
		row.envelope.sealed,
	);
	expect((await a.store.get(row.messageId))?.nodeReceipts).toHaveLength(1);
	expect((await a.store.get(row.messageId))?.serverReceipt).toBeNull();
});
it("native adapter refuses revoked identities before accepting any incident", async () => {
	const [a, b] = await pair();
	b.trust = { ...b.trust, revoked: [a.identity.subject] };
	const [one, two] = wires(),
		ta = new AuthenticatedRadio(a, one),
		tb = new AuthenticatedRadio(b, two);
	transports.push(ta, tb);
	await Promise.all([ta.begin(), tb.begin()]);
	await expect(tb.ready()).rejects.toThrow();
	expect(await b.store.rows()).toHaveLength(0);
});

it("radio input queue is bounded before signature work and closes on a frame flood", async () => {
	const [node] = await pair();
	let receive: (data: string) => void = () => {};
	let closed = false;
	const transport = new AuthenticatedRadio(node, {
		send: async () => {},
		close: () => {
			closed = true;
		},
		onData: (callback) => {
			receive = callback;
			return () => {};
		},
	});
	transports.push(transport);
	for (let i = 0; i < 129; i++) receive("{}");
	await expect(transport.ready()).rejects.toThrow();
	expect(closed).toBe(true);
	expect(await node.store.rows()).toHaveLength(0);
});
