import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
	IncidentSchema,
	type Attachment,
	type Incident,
	type LocalStatus,
	type ServerReceipt,
} from "../../../../../packages/contracts/src";

export interface MediaItem {
	manifest: Attachment;
	blob: Blob;
	original?: Blob;
}
export interface LocalRecord {
	incident: Incident;
	write_key: string;
	status: LocalStatus;
	attempts: number;
	last_attempt: string | null;
	next_attempt: number;
	last_error: string | null;
	receipt: ServerReceipt | null;
	blocked: boolean;
	attachment_receipts: Record<string, string>;
	history: { at: string; status: LocalStatus }[];
}
interface LocalDB extends DBSchema {
	incidents: { key: string; value: LocalRecord };
	media: { key: string; value: MediaItem };
	settings: { key: string; value: unknown };
}
export class LocalStore {
	private db: Promise<IDBPDatabase<LocalDB>>;
	constructor(name = "resilient-records") {
		this.db = openDB<LocalDB>(name, 1, {
			upgrade(db) {
				db.createObjectStore("incidents");
				db.createObjectStore("media");
				db.createObjectStore("settings");
			},
			blocked() {
				window.dispatchEvent(new Event("storage-blocked"));
			},
			blocking(_a, _b, event) {
				(event.target as IDBDatabase).close();
			},
		});
	}
	async save(
		incident: Incident,
		media: MediaItem[] = [],
	): Promise<LocalRecord> {
		const checked = IncidentSchema.parse(incident);
		if (
			checked.attachments.some(
				(a) => !media.some((m) => m.manifest.attachment_id === a.attachment_id),
			)
		)
			throw new Error("Anexo local ausente. Preserve o rascunho.");
		const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
			v.toString(16).padStart(2, "0"),
		).join("");
		const record: LocalRecord = {
			incident: checked,
			write_key: key,
			status: "SALVO_LOCALMENTE",
			attempts: 0,
			last_attempt: null,
			next_attempt: 0,
			last_error: null,
			receipt: null,
			blocked: false,
			attachment_receipts: {},
			history: [{ at: new Date().toISOString(), status: "SALVO_LOCALMENTE" }],
		};
		const tx = (await this.db).transaction(["incidents", "media", "settings"], "readwrite");
		await Promise.all([
			tx.objectStore("incidents").add(record, checked.incident_id),
			tx.objectStore("settings").delete("draft"),
			...media.map((item) =>
				tx.objectStore("media").put(item, item.manifest.attachment_id),
			),
			tx.done,
		]);
		return record;
	}
	async list() {
		return (await (await this.db).getAll("incidents")).sort((a, b) =>
			b.incident.created_at.localeCompare(a.incident.created_at),
		);
	}
	async get(id: string) {
		return (await this.db).get("incidents", id);
	}
	async update(id: string, change: (row: LocalRecord) => void) {
		const tx = (await this.db).transaction("incidents", "readwrite");
		void tx.done.catch(() => {}); // The request error is rethrown; consume the parallel transaction rejection.
		const row = await tx.store.get(id);
		if (!row) throw new Error("Registro local não encontrado.");
		change(row);
		await tx.store.put(row, id);
		await tx.done;
		return row;
	}
	async media(id: string) {
		return (await this.db).get("media", id);
	}
	async setting<T>(key: string) {
		return (await this.db).get("settings", key) as Promise<T | undefined>;
	}
	async setSetting(key: string, value: unknown) {
		const db = await this.db;
		const tx = db.transaction("settings", "readwrite");
		await Promise.all([tx.store.put(value, key), tx.done]);
	}
	async close() {
		(await this.db).close();
	}
}

export function setStatus(row: LocalRecord, status: LocalStatus) {
	if (row.receipt && status !== "RECEBIDO_SERVIDOR")
		throw new Error("Não regredir recibo confirmado.");
	if (row.status !== status) {
		row.status = status;
		row.history.push({ status, at: new Date().toISOString() });
	}
}
