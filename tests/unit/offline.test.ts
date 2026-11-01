import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncidentSchema } from "../../packages/contracts/src";
import {
	LocalStore,
	setStatus,
} from "../../apps/citizen-app/src/features/offline-storage/store";
import {
	backoff,
	SyncQueue,
} from "../../apps/citizen-app/src/features/sync/queue";

const stores: LocalStore[] = [];
const makeStore = (name = crypto.randomUUID()) => {
	const s = new LocalStore(name);
	stores.push(s);
	return s;
};
const incident = () =>
	IncidentSchema.parse({
		schema_version: 1,
		incident_id: crypto.randomUUID(),
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		record_type: "help",
		description: "Água subindo 🌧",
		synthetic: true,
	});
const receipt = (id: string) => ({
	receipt_id: crypto.randomUUID(),
	incident_id: id,
	status: "RECEBIDO_SERVIDOR",
	server_received_at: new Date().toISOString(),
	code: "PERSISTED",
	message: "Recebido pelo protótipo",
	attachment_ids_received: [],
});
afterEach(async () => {
	await Promise.all(stores.splice(0).map((s) => s.close()));
});
describe("fila persistente", () => {
	it("recupera após fechar e abrir o banco", async () => {
		const name = crypto.randomUUID(),
			s = makeStore(name),
			i = incident();
		await s.save(i);
		await s.close();
		const reopened = makeStore(name);
		expect((await reopened.get(i.incident_id))?.incident.description).toBe(
			i.description,
		);
	});
	it("não confirma gravação que falha", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		await expect(s.save(i)).rejects.toThrow();
		expect(await s.list()).toHaveLength(1);
	});
	it("mantém registro e agenda retentativa em falha de rede", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		await new SyncQueue(
			s,
			vi.fn().mockRejectedValue(new TypeError("rede")),
		).run();
		const r = await s.get(i.incident_id);
		expect(r?.receipt).toBeNull();
		expect(r?.status).toBe("AGUARDANDO_CONEXAO");
		expect(r?.next_attempt).toBeGreaterThan(Date.now());
		expect(r?.attempts).toBe(1);
	});
	it("recusa HTTP 200 sem recibo válido", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		await new SyncQueue(
			s,
			vi.fn().mockResolvedValue(Response.json({ ok: true })),
		).run();
		expect((await s.get(i.incident_id))?.receipt).toBeNull();
	});
	it("recusa recibo de outro identificador", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		await new SyncQueue(
			s,
			vi.fn().mockResolvedValue(Response.json(receipt(crypto.randomUUID()))),
		).run();
		expect((await s.get(i.incident_id))?.receipt).toBeNull();
	});
	it("confirma recebimento sem gerar outro identificador", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		const request = vi.fn().mockImplementation(async (_url, options) => {
			expect(JSON.parse(options.body).incident.incident_id).toBe(i.incident_id);
			return Response.json(receipt(i.incident_id));
		});
		const q = new SyncQueue(s, request);
		await q.run();
		await q.run(true);
		expect(request).toHaveBeenCalledTimes(1);
		expect((await s.get(i.incident_id))?.status).toBe("RECEBIDO_SERVIDOR");
	});
	it("suspende erro permanente sem apagar o registro", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		const request = vi
			.fn()
			.mockImplementation(async () => new Response("", { status: 409 }));
		const q = new SyncQueue(s, request);
		await q.run();
		await q.run(true);
		expect(request).toHaveBeenCalledTimes(1);
		expect((await s.get(i.incident_id))?.blocked).toBe(true);
	});
	it("mantém anexo pendente se upload falhar e preserva recibo principal", async () => {
		const s = makeStore(),
			i = incident(),
			aid = crypto.randomUUID();
		const manifest = {
			attachment_id: aid,
			kind: "audio" as const,
			mime_type: "audio/webm" as const,
			byte_size: 4,
			sha256: "a".repeat(64),
		};
		i.attachments = [manifest];
		await s.save(i, [{ manifest, blob: new Blob(["1234"]) }]);
		const request = vi
			.fn()
			.mockImplementation(async (url) =>
				url.endsWith("/attachments")
					? new Response("", { status: 503 })
					: Response.json(receipt(i.incident_id)),
			);
		await new SyncQueue(s, request).run();
		const r = await s.get(i.incident_id);
		expect(r?.receipt).not.toBeNull();
		expect(r?.attachment_receipts).toEqual({});
		expect(r?.status).toBe("RECEBIDO_SERVIDOR");
	});
	it("prioriza todos os registros essenciais antes dos anexos", async () => {
		const s = makeStore(),
			i = incident(),
			j = incident(),
			aid = crypto.randomUUID();
		const manifest = {
			attachment_id: aid,
			kind: "audio" as const,
			mime_type: "audio/webm" as const,
			byte_size: 4,
			sha256: "a".repeat(64),
		};
		i.attachments = [manifest];
		await s.save(i, [{ manifest, blob: new Blob(["1234"]) }]);
		await s.save(j);
		const calls: string[] = [];
		const request = vi.fn().mockImplementation(async (url, options) => {
			calls.push(url);
			return url.endsWith("/attachments")
				? new Response("", { status: 503 })
				: Response.json(receipt(JSON.parse(options.body).incident.incident_id));
		});
		await new SyncQueue(s, request).run();
		expect(calls.slice(0, 2)).toEqual([
			"/api/v1/incidents",
			"/api/v1/incidents",
		]);
		expect(calls[2]).toContain("/attachments");
	});
	it("agenda essenciais de relay antes da mídia e isola falha mesh", async () => {
		const s = makeStore(),
			i = incident();
		const manifest = {
			attachment_id: crypto.randomUUID(),
			kind: "audio" as const,
			mime_type: "audio/webm" as const,
			byte_size: 4,
			sha256: "a".repeat(64),
		};
		i.attachments = [manifest];
		await s.save(i, [{ manifest, blob: new Blob(["1234"]) }]);
		const calls: string[] = [];
		const request = vi.fn().mockImplementation(async (url) => {
			calls.push(url.endsWith("/attachments") ? "media" : "own");
			return url.endsWith("/attachments")
				? new Response("", { status: 503 })
				: Response.json(receipt(i.incident_id));
		});
		const queue = new SyncQueue(s, request);
		queue.beforeAttachments = async () => {
			calls.push("relay");
			throw new Error("Relay unavailable");
		};
		await queue.run();
		expect(calls).toEqual(["own", "relay", "media"]);
		expect(queue.relayFailure).toBeInstanceOf(Error);
		expect((await s.get(i.incident_id))?.receipt).not.toBeNull();
	});
	it("não regride um recibo persistido", async () => {
		const s = makeStore(),
			i = incident();
		await s.save(i);
		await new SyncQueue(
			s,
			vi
				.fn()
				.mockImplementation(async () => Response.json(receipt(i.incident_id))),
		).run();
		const row = (await s.get(i.incident_id))!;
		expect(() => setStatus(row, "SALVO_LOCALMENTE")).toThrow();
	});
	it("retentativas progressivas e limitadas", () => {
		expect(backoff(1, () => 0.5)).toBe(5000);
		expect(backoff(2, () => 0.5)).toBe(10000);
		expect(backoff(40, () => 0.5)).toBe(300000);
	});
});
