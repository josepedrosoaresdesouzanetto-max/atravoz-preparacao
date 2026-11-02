import { diagnostics } from "../../diagnostics/src";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Envelope, Identity, Trust, VerifiedEnvelope } from "./protocol";
import type { ResourcePolicy } from "./resource-policy";

export type MeshRow = {
	messageId: string;
	originHash: string;
	envelope: Envelope;
	ownIncidentId: string | null;
	expires: number;
	storedAt: number;
	bytes: number;
	attempts: number;
	nextAttempt: number;
	forwarded: string[];
	nodeReceipts: string[];
	serverReceipt: string | null;
};
export type MeshMetrics = {
	received: number;
	forwarded: number;
	duplicates: number;
	attempts: number;
	bytesSent: number;
	failures: number;
	expired: number;
	hopsReceived: number;
	retentionSeconds: number;
	day: string;
	internetBytes: number;
};
const fresh = (): MeshMetrics => ({
	received: 0,
	forwarded: 0,
	duplicates: 0,
	attempts: 0,
	bytesSent: 0,
	failures: 0,
	expired: 0,
	hopsReceived: 0,
	retentionSeconds: 0,
	day: "",
	internetBytes: 0,
});
interface MeshDB extends DBSchema {
	messages: { key: string; value: MeshRow };
	seen: { key: string; value: { hash: string; until: number } };
	receipts: { key: string; value: { proof: string; until: number } };
	sessions: { key: string; value: number };
	settings: { key: string; value: unknown };
}
export class MeshStore {
	private db: Promise<IDBPDatabase<MeshDB>>;
	constructor(readonly name = "resilient-mesh-v1") {
		this.db = openDB<MeshDB>(name, 1, {
			upgrade(db) {
				for (const store of [
					"messages",
					"seen",
					"receipts",
					"sessions",
					"settings",
				] as const)
					db.createObjectStore(store);
			},
		});
	}
	async setting<T>(key: string) {
		return (await this.db).get("settings", key) as Promise<T | undefined>;
	}
	async set(key: string, value: unknown) {
		const tx = (await this.db).transaction("settings", "readwrite");
		await Promise.all([tx.store.put(value, key), tx.done]);
	}
	async identity() {
		return this.setting<Identity>("identity");
	}
	async trust() {
		return this.setting<Trust>("trust");
	}
	async rows() {
		return (await this.db).getAll("messages");
	}
	async get(id: string) {
		return (await this.db).get("messages", id);
	}
	async metrics() {
		return (await this.setting<MeshMetrics>("metrics")) || fresh();
	}
	async clock(now: number) {
		const tx = (await this.db).transaction("settings", "readwrite");
		void tx.done.catch(() => {});
		const previous = ((await tx.store.get("clock")) as number) || 0;
		if (now < previous - 300)
			throw new Error(
				"Relógio retrocedeu: mesh pausada; pedidos próprios preservados.",
			);
		await tx.store.put(Math.max(previous, now), "clock");
		await tx.done;
	}
	async metric(change: Partial<MeshMetrics>) {
		const tx = (await this.db).transaction("settings", "readwrite");
		void tx.done.catch(() => {});
		const m = ((await tx.store.get("metrics")) as MeshMetrics) || fresh();
		for (const [k, v] of Object.entries(change))
			if (typeof v === "number" && k !== "internetBytes")
				(m as unknown as Record<string, number>)[k] += v;
		await tx.store.put(m, "metrics");
		await tx.done;
	}
	async reserveInternet(bytes: number, policy: ResourcePolicy, now: number) {
		const tx = (await this.db).transaction("settings", "readwrite");
		void tx.done.catch(() => {});
		const m = ((await tx.store.get("metrics")) as MeshMetrics) || fresh(),
			day = new Date(now * 1000).toISOString().slice(0, 10);
		if (m.day !== day) {
			m.day = day;
			m.internetBytes = 0;
		}
		if (m.internetBytes + bytes > policy.dailyInternetBytes)
			throw resourceLimit("Cota diária de internet atingida.");
		m.internetBytes += bytes;
		await tx.store.put(m, "metrics");
		await tx.done;
	}
	async accept(
		checked: VerifiedEnvelope,
		policy: ResourcePolicy,
		now: number,
		ownIncidentId: string | null = null,
	) {
		const tx = (await this.db).transaction(
			["messages", "seen", "settings"],
			"readwrite",
		);
		void tx.done.catch(() => {});
		const id = checked.origin.message_id,
			old = await tx.objectStore("seen").get(id);
		if (old && old.hash !== checked.originHash)
			throw new Error("Identificador reutilizado com conteúdo diferente.");
		const existing = await tx.objectStore("messages").get(id);
		if (existing) return { row: existing, duplicate: true };
		if (old)
			throw new Error("Mensagem já finalizada ou expirada; replay recusado.");
		if ((await tx.objectStore("seen").count()) >= 2048)
			throw resourceLimit("Cota de proteção contra replay atingida.");
		const rows = await tx.objectStore("messages").getAll();
		const relays = rows.filter((r) => !r.ownIncidentId),
			bytes = new TextEncoder().encode(JSON.stringify(checked.envelope)).length;
		if (
			!ownIncidentId &&
			(relays.length >= policy.maxMessages ||
				relays.reduce((sum, r) => sum + r.bytes, 0) + bytes > policy.relayBytes)
		)
			throw resourceLimit(
				"Cota de retransmissão cheia; pedido de origem não foi apagado.",
			);
		if (ownIncidentId && rows.filter((r) => r.ownIncidentId).length >= 100)
			throw resourceLimit(
				"Limite de envelopes próprios; ocorrência original preservada.",
			);
		const row: MeshRow = {
			messageId: id,
			originHash: checked.originHash,
			envelope: checked.envelope,
			ownIncidentId,
			expires: checked.origin.expires,
			storedAt: now,
			bytes,
			attempts: 0,
			nextAttempt: 0,
			forwarded: [],
			nodeReceipts: [],
			serverReceipt: null,
		};
		await tx.objectStore("messages").add(row, id);
		await tx
			.objectStore("seen")
			.put(
				{ hash: checked.originHash, until: checked.origin.expires + 86400 },
				id,
			);
		await tx.done;
		return { row, duplicate: false };
	}
	async update(id: string, change: (r: MeshRow) => void) {
		const tx = (await this.db).transaction("messages", "readwrite");
		void tx.done.catch(() => {});
		const row = await tx.store.get(id);
		if (!row) throw new Error("Envelope não encontrado.");
		change(row);
		await tx.store.put(row, id);
		await tx.done;
		return row;
	}
	async receipt(id: string, proof: string, until: number) {
		const tx = (await this.db).transaction("receipts", "readwrite");
		void tx.done.catch(() => {});
		if ((await tx.store.count()) >= 2048 && !(await tx.store.get(id)))
			throw new Error("Cota de recibos atingida.");
		await tx.store.put({ proof, until }, id);
		await tx.done;
	}
	async receipts() {
		return (await this.db).getAll("receipts");
	}
	async claimSession(id: string, until: number, now: number) {
		const tx = (await this.db).transaction("sessions", "readwrite");
		void tx.done.catch(() => {});
		const entries = await tx.store.getAllKeys();
		if (entries.length >= 256) throw new Error("Limite de sessões atingido.");
		if (await tx.store.get(id)) throw new Error("Sessão já utilizada.");
		if (until <= now || until > now + 120) throw new Error("Sessão expirada.");
		await tx.store.add(until, id);
		await tx.done;
	}
	async maintain(now: number) {
		const tx = (await this.db).transaction(
			["messages", "seen", "receipts", "sessions"],
			"readwrite",
		);
		void tx.done.catch(() => {});
		let expired = 0;
		for (const row of await tx.objectStore("messages").getAll())
			if (!row.ownIncidentId && (row.expires <= now || row.serverReceipt)) {
				await tx.objectStore("messages").delete(row.messageId);
				expired++;
			}
		for (const key of await tx.objectStore("seen").getAllKeys())
			if ((await tx.objectStore("seen").get(key))!.until <= now)
				await tx.objectStore("seen").delete(key);
		for (const key of await tx.objectStore("receipts").getAllKeys())
			if ((await tx.objectStore("receipts").get(key))!.until <= now)
				await tx.objectStore("receipts").delete(key);
		for (const key of await tx.objectStore("sessions").getAllKeys())
			if ((await tx.objectStore("sessions").get(key))! <= now)
				await tx.objectStore("sessions").delete(key);
		await tx.done;
		if (expired) await this.metric({ expired });
	}
	async close() {
		(await this.db).close();
	}
}

function resourceLimit(message: string) {
	void diagnostics.record("RESOURCE_LIMIT", "storage", "save", {
		recovery: "manual",
	});
	return new Error(message);
}
