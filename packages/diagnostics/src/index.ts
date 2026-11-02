import { openDB, type DBSchema } from "idb";
import { z } from "zod";
export const APP_VERSION = "0.2.0-test";
export const codes = [
	"APP_START",
	"APP_FAILURE",
	"STORAGE_FAILED",
	"SYNC_FAILED",
	"UPLOAD_FAILED",
	"NETWORK_OFFLINE",
	"NETWORK_ONLINE",
	"RADIO_DISCOVERY_FAILED",
	"MESH_AUTH_FAILED",
	"MESH_TRANSFER_FAILED",
	"FRAGMENT_REJECTED",
	"INTEGRITY_REJECTED",
	"CRYPTO_FAILED",
	"DUPLICATE_AVOIDED",
	"RESOURCE_LIMIT",
	"CAMERA_FAILED",
	"MICROPHONE_FAILED",
	"API_FAILED",
	"AI_FAILED",
	"CENTRAL_FAILED",
	"UPDATE_FAILED",
	"RECOVERED",
	"EXPORT_READY",
] as const;
export const EventSchema = z
	.object({
		event_id: z.string().uuid(),
		correlation_id: z.string().uuid(),
		at: z.string().datetime({ offset: true }),
		last_at: z.string().datetime({ offset: true }),
		version: z
			.string()
			.regex(/^\d+\.\d+\.\d+(?:-[a-z0-9]+)?$/)
			.max(30),
		platform: z.enum([
			"android",
			"windows",
			"ios",
			"linux",
			"macos",
			"unknown",
		]),
		module: z.enum([
			"app",
			"storage",
			"sync",
			"mesh",
			"media",
			"api",
			"ai",
			"central",
			"update",
		]),
		operation: z.enum([
			"initialize",
			"save",
			"send",
			"receive",
			"discover",
			"authenticate",
			"upload",
			"capture",
			"analyze",
			"export",
			"update",
			"connect",
		]),
		code: z.enum(codes),
		result: z.enum(["success", "failure", "pending", "recovered"]),
		recovery: z.enum(["none", "queued", "retry", "fallback", "manual"]),
		attempt: z.number().int().min(0).max(100),
		duration_ms: z.number().int().min(0).max(3600000),
		network: z.enum(["online", "offline", "unknown"]),
		count: z.number().int().min(1).max(10000),
	})
	.strict();
export type DiagnosticEvent = z.infer<typeof EventSchema>;
export const ReportSchema = z
	.object({
		schema_version: z.literal(1),
		report_id: z.string().uuid(),
		created_at: z.string().datetime({ offset: true }),
		events: z.array(EventSchema).max(100),
		privacy: z.literal("allowlisted-technical-fields-only"),
	})
	.strict();
export type DiagnosticReport = z.infer<typeof ReportSchema>;
interface DiagnosticsDB extends DBSchema {
	events: { key: string; value: DiagnosticEvent };
	settings: { key: string; value: unknown };
	queue: {
		key: string;
		value: {
			report: DiagnosticReport;
			expires: number;
			attempts: number;
			next: number;
		};
	};
}
function platform(): DiagnosticEvent["platform"] {
	const s = typeof navigator === "undefined" ? "" : navigator.userAgent;
	return /Android/.test(s)
		? "android"
		: /Windows/.test(s)
			? "windows"
			: /iPhone|iPad/.test(s)
				? "ios"
				: /Mac/.test(s)
					? "macos"
					: /Linux/.test(s)
						? "linux"
						: "unknown";
}
export class Diagnostics {
	private db;
	private fallback: DiagnosticEvent[] = [];
	private chain = Promise.resolve();
	private queuedEvents = 0;
	constructor(
		name = "resilient-diagnostics-v1",
		readonly now = () => Date.now(),
	) {
		this.db = openDB<DiagnosticsDB>(name, 1, {
			upgrade(db) {
				db.createObjectStore("events");
				db.createObjectStore("settings");
				db.createObjectStore("queue");
			},
		});
		void this.db.catch(() => {});
	}
	record(
		code: (typeof codes)[number],
		module: DiagnosticEvent["module"],
		operation: DiagnosticEvent["operation"],
		options: Partial<
			Pick<
				DiagnosticEvent,
				"result" | "recovery" | "attempt" | "duration_ms" | "correlation_id"
			>
		> = {},
	) {
		if (this.queuedEvents >= 100) return this.chain;
		this.queuedEvents++;
		this.chain = this.chain
			.then(async () => {
				const at = new Date(this.now()).toISOString();
				const event = EventSchema.parse({
					event_id: crypto.randomUUID(),
					correlation_id: options.correlation_id || crypto.randomUUID(),
					at,
					last_at: at,
					version: APP_VERSION,
					platform: platform(),
					module,
					operation,
					code,
					result: options.result || "failure",
					recovery: options.recovery || "none",
					attempt: Math.min(100, Math.max(0, options.attempt || 0)),
					duration_ms: Math.min(
						3600000,
						Math.max(0, Math.round(options.duration_ms || 0)),
					),
					network:
						typeof navigator === "undefined"
							? "unknown"
							: navigator.onLine
								? "online"
								: "offline",
					count: 1,
				});
				try {
					const db = await this.db,
						days = await this.retention();
					const tx = db.transaction("events", "readwrite");
					void tx.done.catch(() => {});
					let rows = await tx.store.getAll();
					for (const old of rows)
						if (Date.parse(old.last_at) < this.now() - days * 86400000)
							await tx.store.delete(old.event_id);
					rows = rows
						.filter(
							(e) => Date.parse(e.last_at) >= this.now() - days * 86400000,
						)
						.sort((a, b) => a.last_at.localeCompare(b.last_at));
					const old = rows.find(
						(e) =>
							e.code === code &&
							e.module === module &&
							e.operation === operation &&
							e.result === event.result &&
							this.now() - Date.parse(e.last_at) < 30000,
					);
					if (old) {
						old.count = Math.min(10000, old.count + 1);
						old.last_at = at;
						await tx.store.put(old, old.event_id);
					} else {
						await tx.store.put(event, event.event_id);
						rows.push(event);
					}
					while (rows.length > 300 || JSON.stringify(rows).length > 200000) {
						const first = rows.shift()!;
						await tx.store.delete(first.event_id);
					}
					await tx.done;
				} catch {
					this.fallback = [...this.fallback, event].slice(-30);
				}
			})
			.catch(() => {})
			.finally(() => {
				this.queuedEvents--;
			});
		return this.chain;
	}
	async retention() {
		try {
			return z
				.union([z.literal(1), z.literal(3), z.literal(7)])
				.parse((await (await this.db).get("settings", "retention")) || 3);
		} catch {
			return 3;
		}
	}
	async setRetention(days: 1 | 3 | 7) {
		await (await this.db).put("settings", days, "retention");
		await this.events();
	}
	async events() {
		await this.chain;
		try {
			const db = await this.db,
				days = await this.retention(),
				tx = db.transaction("events", "readwrite");
			void tx.done.catch(() => {});
			const rows = await tx.store.getAll();
			for (const r of rows)
				if (Date.parse(r.last_at) < this.now() - days * 86400000)
					await tx.store.delete(r.event_id);
			await tx.done;
			return rows
				.filter((e) => Date.parse(e.last_at) >= this.now() - days * 86400000)
				.sort((a, b) => b.last_at.localeCompare(a.last_at));
		} catch {
			return this.fallback.filter(
				(e) => Date.parse(e.last_at) >= this.now() - 3 * 86400000,
			);
		}
	}
	async report() {
		return ReportSchema.parse({
			schema_version: 1,
			report_id: crypto.randomUUID(),
			created_at: new Date(this.now()).toISOString(),
			events: (await this.events()).slice(0, 100),
			privacy: "allowlisted-technical-fields-only",
		});
	}
	async enqueue(report: DiagnosticReport) {
		const checked = ReportSchema.parse(report);
		if (JSON.stringify(checked).length > 65536)
			throw new Error("Relatório acima da cota.");
		const db = await this.db,
			tx = db.transaction("queue", "readwrite");
		void tx.done.catch(() => {});
		for (const key of await tx.store.getAllKeys())
			if ((await tx.store.get(key))!.expires <= this.now())
				await tx.store.delete(key);
		if ((await tx.store.count()) >= 3)
			throw new Error(
				"Já existem três diagnósticos aguardando envio. Exporte ou tente depois.",
			);
		await tx.store.add(
			{ report: checked, expires: this.now() + 86400000, attempts: 0, next: 0 },
			checked.report_id,
		);
		await tx.done;
	}
	async sendQueued(
		send: (report: DiagnosticReport) => Promise<void>,
		consent: boolean,
		wifiConfirmed: boolean,
	) {
		if (!consent || !wifiConfirmed)
			throw new Error(
				"Confirme autorização e Wi-Fi antes de enviar diagnósticos.",
			);
		const db = await this.db;
		for (const row of await db.getAll("queue")) {
			if (row.expires <= this.now()) {
				await db.delete("queue", row.report.report_id);
				continue;
			}
			if (row.attempts >= 5 || row.next > this.now()) continue;
			row.attempts++;
			row.next = this.now() + Math.min(300000, 5000 * 2 ** row.attempts);
			await db.put("queue", row, row.report.report_id);
			await send(row.report);
			await db.delete("queue", row.report.report_id);
		}
	}
	async queued() {
		const db = await this.db;
		const tx = db.transaction("queue", "readwrite");
		void tx.done.catch(() => {});
		for (const key of await tx.store.getAllKeys())
			if ((await tx.store.get(key))!.expires <= this.now())
				await tx.store.delete(key);
		const count = await tx.store.count();
		await tx.done;
		return count;
	}
	async clear() {
		await (await this.db).clear("events");
		await (await this.db).clear("queue");
		this.fallback = [];
	}
	async close() {
		await this.chain;
		(await this.db).close();
	}
}
export const diagnostics = new Diagnostics();
const problem = (e: DiagnosticEvent) =>
	`${e.code} no módulo ${e.module}, operação ${e.operation}`;
export function markdownReport(input: unknown) {
	const r = ReportSchema.parse(input);
	const grouped = Object.entries(
		r.events.reduce<Record<string, number>>((a, e) => {
			a[e.code] = (a[e.code] || 0) + e.count;
			return a;
		}, {}),
	)
		.map(([code, count]) => `- ${code}: ${count}`)
		.join("\n");
	return `# ATRAVOZ — diagnóstico técnico\n\nRelatório ${r.report_id} · ${r.created_at}\n\n## 1. Problema\n${r.events.filter((e) => e.result === "failure").length} grupos de eventos de falha registrados.\n\n## 2. Onde ocorreu\n${[...new Set(r.events.map((e) => e.module))].join(", ") || "Sem eventos"}\n\n## 3. Quando ocorreu\n${r.events.map((e) => `${e.at} → ${e.last_at}`).join("\n") || "Sem eventos"}\n\n## 4. Comportamento esperado\nConcluir a operação ou preservar dados pendentes com erro explícito; nunca confirmar entrega sem recibo.\n\n## 5. Comportamento observado\n${r.events.map((e) => `- ${problem(e)}: ${e.result}`).join("\n") || "Sem eventos"}\n\n## 6. Códigos e frequência\n${grouped || "Sem eventos"}\n\n## 7. Tentativas realizadas\n${r.events.map((e) => `- ${e.code}: tentativa ${e.attempt}; recuperação ${e.recovery}`).join("\n") || "Sem eventos"}\n\n## 8. Resultado da recuperação\n${r.events.filter((e) => e.result === "recovered").length} eventos recuperados; ${r.events.filter((e) => e.result === "pending").length} pendentes. Ausência de evento recuperado não comprova falha permanente.\n\n## 9. Evidências técnicas\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`\n\n## 10. Hipóteses para investigação\nHipóteses, não causas comprovadas: para SYNC/API, verificar alcance da central; para MESH/RADIO, conferir autorização, permissões e ciclo de vida; para STORAGE/RESOURCE, verificar espaço e cotas.\n\n## 11. Melhorias recomendadas\nPriorizar códigos mais frequentes acima; reproduzir a mesma operação/versão com dados fictícios, comparar correlação e tempo; executar os testes correspondentes antes de alterar limites. Sem eventos suficientes, não há recomendação causal específica.\n\n## 12. Limitações\nRelatório limitado aos 100 eventos recentes selecionados, com repetição agregada. Não contém relato, nome, localização, mídia, senha, chave, URL, endereço Bluetooth ou stack trace. Correlação é aleatória e não é ID de ocorrência. Não comprova causa raiz, alcance de rádio ou atendimento. Revise antes de compartilhar; o envio não é automático.\n`;
}
