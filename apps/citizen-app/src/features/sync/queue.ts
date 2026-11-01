import { ReceiptSchema } from "../../../../../packages/contracts/src";
import {
	LocalStore,
	setStatus,
	type LocalRecord,
} from "../offline-storage/store";

export const backoff = (attempt: number, random = Math.random) =>
	Math.min(300000, 5000 * 2 ** Math.min(attempt - 1, 6)) *
	(0.8 + random() * 0.4);
const pending = (r: LocalRecord) =>
	!r.receipt ||
	r.incident.attachments.some((a) => !r.attachment_receipts[a.attachment_id]);
class DeliveryError extends Error {
	constructor(
		message: string,
		public permanent = false,
	) {
		super(message);
	}
}
async function checked(response: Response) {
	if (!response.ok)
		throw new DeliveryError(
			`Servidor respondeu ${response.status}. Registro preservado.`,
			[400, 401, 403, 409, 413, 415, 422].includes(response.status),
		);
	return response.json();
}
export class SyncQueue {
	private running = false;
	constructor(
		private store: LocalStore,
		private request: typeof fetch = fetch,
		private changed: () => void = () => {},
	) {}
	async run(force = false) {
		if (this.running) return;
		this.running = true;
		try {
			if (typeof navigator !== "undefined" && navigator.locks)
				await navigator.locks.request("resilient-sync", () =>
					this.flush(force),
				);
			else await this.flush(force);
		} finally {
			this.running = false;
			this.changed();
		}
	}
	private async call(url: string, options: RequestInit) {
		return this.request.call(globalThis, url, {
			...options,
			signal: AbortSignal.timeout(15000),
			cache: "no-store",
		});
	}
	private async fail(id: string, error: unknown) {
		await this.store.update(id, (row) => {
			row.last_error =
				error instanceof Error
					? error.message
					: "Falha de conexão. Registro preservado.";
			row.blocked = error instanceof DeliveryError && error.permanent;
			row.next_attempt = Date.now() + backoff(row.attempts);
			if (!row.receipt) setStatus(row, "AGUARDANDO_CONEXAO");
		});
		this.changed();
	}
	private async flush(force: boolean) {
		const batch = (await this.store.list())
			.filter(
				(r) =>
					pending(r) && !r.blocked && (force || r.next_attempt <= Date.now()),
			)
			.reverse()
			.slice(0, 10);
		// All essential records have priority over any attachment.
		for (const stale of batch) {
			const id = stale.incident.incident_id;
			let row = (await this.store.get(id))!;
			if (row.receipt) continue;
			row = await this.store.update(id, (r) => {
				r.attempts++;
				r.last_attempt = new Date().toISOString();
				setStatus(r, "AGUARDANDO_CONEXAO");
			});
			try {
				const response = await this.call("/api/v1/incidents", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						incident: row.incident,
						write_key: row.write_key,
					}),
				});
				const receipt = ReceiptSchema.parse(await checked(response));
				if (receipt.incident_id !== id)
					throw new DeliveryError(
						"Recibo de outra ocorrência; envio não confirmado.",
					);
				await this.store.update(id, (r) => {
					r.receipt = receipt;
					setStatus(r, "RECEBIDO_SERVIDOR");
					r.last_error = null;
					r.next_attempt = 0;
				});
				this.changed();
			} catch (error) {
				await this.fail(id, error);
			}
		}
		for (const stale of batch) {
			const id = stale.incident.incident_id;
			let row = (await this.store.get(id))!;
			if (
				!row.receipt ||
				row.blocked ||
				(!force && row.next_attempt > Date.now())
			)
				continue;
			const attachments = [...row.incident.attachments].sort((a, b) =>
				a.kind.localeCompare(b.kind),
			);
			for (const attachment of attachments) {
				row = (await this.store.get(id))!;
				if (row.attachment_receipts[attachment.attachment_id]) continue;
				await this.store.update(id, (r) => {
					r.attempts++;
					r.last_attempt = new Date().toISOString();
				});
				try {
					const media = await this.store.media(attachment.attachment_id);
					if (!media)
						throw new DeliveryError(
							"Arquivo local ausente; anexo não entregue.",
							true,
						);
					const result = await checked(
						await this.call(`/api/v1/incidents/${id}/attachments`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${row.write_key}`,
								"X-Attachment-ID": attachment.attachment_id,
								"Content-Type": attachment.mime_type,
							},
							body: media.blob,
						}),
					);
					if (
						result.attachment_id !== attachment.attachment_id ||
						result.incident_id !== id ||
						result.sha256 !== attachment.sha256 ||
						result.status !== "RECEBIDO_SERVIDOR" ||
						!Number.isFinite(Date.parse(result.received_at))
					)
						throw new DeliveryError("Recibo de anexo inválido.");
					await this.store.update(id, (r) => {
						r.attachment_receipts[attachment.attachment_id] =
							result.received_at;
						r.last_error = null;
						r.next_attempt = 0;
					});
					this.changed();
				} catch (error) {
					await this.fail(id, error);
					break;
				}
			}
		}
	}
}
