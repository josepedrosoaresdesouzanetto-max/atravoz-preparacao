import { useState } from "react";
import { z } from "zod";
import {
	EventSchema,
	ReportSchema,
	markdownReport,
} from "../../../packages/diagnostics/src";
import { saveText } from "../../shared/native";
import { request } from "./api";
const schema = z.object({
	reports: z.array(ReportSchema),
	server_events: z.array(EventSchema),
	frequencies: z.record(z.string(), z.number()),
	versions: z.array(z.string()),
	recovered: z.number(),
	pending: z.number(),
	scope: z.string(),
});
export function SystemDiagnostics({ token }: { token: string }) {
	const [data, setData] = useState<z.infer<typeof schema> | null>(null),
		[error, setError] = useState(""),
		[busy, setBusy] = useState(false);
	const load = async () => {
		setBusy(true);
		try {
			setData(
				schema.parse(await (await request(token, "/diagnostics")).json()),
			);
			setError("");
		} catch {
			setError("Não foi possível consultar os diagnósticos autenticados.");
		} finally {
			setBusy(false);
		}
	};
	const report = () =>
		ReportSchema.parse({
			schema_version: 1,
			report_id: crypto.randomUUID(),
			created_at: new Date().toISOString(),
			events: [
				...(data?.server_events || []),
				...(data?.reports.flatMap((r) => r.events) || []),
			].slice(0, 100),
			privacy: "allowlisted-technical-fields-only",
		});
	return (
		<section className="card">
			<h2>Diagnósticos do Sistema</h2>
			<p>
				Eventos técnicos recebidos com autorização e eventos locais da API. Não
				inclui conteúdo de ocorrências.
			</p>
			<button disabled={busy} onClick={() => void load()}>
				Consultar diagnósticos
			</button>
			{error && <p role="alert">{error}</p>}
			{data && (
				<>
					<p>{data.scope}</p>
					<p>
						Versões: {data.versions.join(", ") || "nenhuma"} · Recuperados:{" "}
						{data.recovered} · Pendentes: {data.pending}
					</p>
					<ul>
						{Object.entries(data.frequencies).map(([code, count]) => (
							<li key={code}>
								{code}: {count}
							</li>
						))}
					</ul>
					<div className="toolbar">
						<button
							onClick={() =>
								void saveText(JSON.stringify(report(), null, 2), "json")
							}
						>
							Exportar diagnóstico em JSON
						</button>
						<button
							onClick={() => void saveText(markdownReport(report()), "md")}
						>
							Exportar relatório em Markdown
						</button>
					</div>
					<details>
						<summary>Eventos recentes para reprodução</summary>
						{report()
							.events.slice(0, 30)
							.map((e) => (
								<p key={e.event_id}>
									{e.at} · {e.module}/{e.operation} · {e.code} · {e.result} ·
									recuperação {e.recovery} · correlação {e.correlation_id}
								</p>
							))}
					</details>
				</>
			)}
		</section>
	);
}
