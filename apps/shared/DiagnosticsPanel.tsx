import { useEffect, useState } from "react";
import {
	diagnostics,
	markdownReport,
	type DiagnosticEvent,
} from "../../packages/diagnostics/src";
import { apiFetch, saveText } from "./native";
import { MeshStore } from "../../packages/mesh-core/src/storage";
import { digest, sign } from "../../packages/mesh-core/src/security";
import { seconds } from "../../packages/mesh-core/src/protocol";
export function DiagnosticsPanel() {
	const [events, setEvents] = useState<DiagnosticEvent[]>([]),
		[message, setMessage] = useState(""),
		[consent, setConsent] = useState(false),
		[wifi, setWifi] = useState(false),
		[retention, setRetention] = useState(3),
		[queued, setQueued] = useState(0);
	const refresh = async () => {
		setEvents(await diagnostics.events());
		setQueued(await diagnostics.queued().catch(() => 0));
		setRetention(await diagnostics.retention());
	};
	useEffect(() => {
		void refresh();
	}, []);
	const run = async (action: () => Promise<void>) => {
		try {
			await action();
			await refresh();
		} catch (e) {
			setMessage(e instanceof Error ? e.message : "Operação não concluída.");
		}
	};
	return (
		<details
			className="card"
			onToggle={(e) => {
				if (e.currentTarget.open) void refresh();
			}}
		>
			<summary>Diagnóstico técnico e exportação</summary>
			<p>
				Eventos técnicos limitados e sem conteúdo de ocorrências. Nenhum
				diagnóstico é distribuído pela mesh. Revise os arquivos antes de
				compartilhá-los com ChatGPT, Codex ou a equipe.
			</p>
			<p>
				{events.length} grupos locais · {queued} relatórios aguardando envio
			</p>
			<label>
				Reter eventos por
				<select
					value={retention}
					onChange={(e) =>
						void run(() =>
							diagnostics.setRetention(Number(e.target.value) as 1 | 3 | 7),
						)
					}
				>
					<option value={1}>1 dia</option>
					<option value={3}>3 dias</option>
					<option value={7}>7 dias</option>
				</select>
			</label>
			<div className="toolbar">
				<button
					onClick={() =>
						void run(async () => {
							await saveText(
								JSON.stringify(await diagnostics.report(), null, 2),
								"json",
							);
							setMessage(
								"Arquivo técnico preparado para revisão e compartilhamento.",
							);
						})
					}
				>
					Exportar diagnóstico em JSON
				</button>
				<button
					onClick={() =>
						void run(async () => {
							await saveText(markdownReport(await diagnostics.report()), "md");
							setMessage(
								"Relatório Markdown preparado. Hipóteses não são causas comprovadas.",
							);
						})
					}
				>
					Exportar relatório em Markdown
				</button>
			</div>
			<label className="check">
				<input
					type="checkbox"
					checked={consent}
					onChange={(e) => setConsent(e.target.checked)}
				/>
				Autorizo enviar estes diagnósticos técnicos à central configurada
			</label>
			<label className="check">
				<input
					type="checkbox"
					checked={wifi}
					onChange={(e) => setWifi(e.target.checked)}
				/>
				Conferi que estou em Wi-Fi para este envio de diagnóstico
			</label>
			<button
				disabled={!consent}
				onClick={() =>
					void run(async () => {
						await diagnostics.enqueue(await diagnostics.report());
						setMessage(
							"Relatório guardado por até 24 horas. Use Enviar autorizados quando houver Wi-Fi.",
						);
					})
				}
			>
				Guardar diagnóstico autorizado na fila
			</button>
			<button
				disabled={!consent || !wifi}
				onClick={() =>
					void run(async () => {
						const mesh = new MeshStore();
						try {
							const identity = await mesh.identity();
							if (!identity)
								throw new Error(
									"Prepare uma credencial de participante com a equipe antes de enviar diagnósticos.",
								);
							await diagnostics.sendQueued(
								async (report) => {
									const serialized = JSON.stringify(report),
										proof = await sign(
											{
												kind: "diagnostic-upload",
												report_id: report.report_id,
												digest: await digest(serialized),
												at: seconds(),
												nonce: crypto.randomUUID(),
											},
											identity.privateKey,
										);
									const response = await apiFetch("/api/v1/diagnostics", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											serialized,
											credential: identity.credential,
											proof,
										}),
										signal: AbortSignal.timeout(15000),
									});
									if (!response.ok)
										throw new Error(
											`Diagnóstico não entregue (${response.status}); fila preservada.`,
										);
									const receipt = await response.json();
									if (
										receipt.report_id !== report.report_id ||
										receipt.status !== "PERSISTED"
									)
										throw new Error(
											"Recibo de diagnóstico inválido; fila preservada.",
										);
								},
								consent,
								wifi,
							);
							setMessage("Diagnósticos autorizados recebidos pela central.");
						} finally {
							await mesh.close();
						}
					})
				}
			>
				Enviar diagnósticos autorizados
			</button>
			<button
				onClick={() =>
					void run(async () => {
						await diagnostics.clear();
						setMessage(
							"Somente eventos e fila de diagnósticos apagados. Ocorrências preservadas.",
						);
					})
				}
			>
				Limpar diagnósticos locais
			</button>
			<p role="status">{message}</p>
		</details>
	);
}
