import { CentralInstall } from "./CentralInstall";
import { MeshEnrollment } from "./MeshEnrollment";
import { SystemDiagnostics } from "./SystemDiagnostics";
import { DiagnosticsPanel } from "../../shared/DiagnosticsPanel";
import { useRef, useState } from "react";
import { Brand } from "../../shared/Brand";
import { statusLabels } from "../../../packages/contracts/src";
import { DetailSchema, PageSchema, request, type Detail } from "./api";

const transitions: Record<string, string[]> = {
	RECEBIDO_SERVIDOR: ["EM_VERIFICACAO", "CORRIGIDO", "INVALIDADO"],
	EM_VERIFICACAO: ["VERIFICADO", "CORRIGIDO", "INVALIDADO"],
	VERIFICADO: ["EM_VERIFICACAO", "CORRIGIDO", "INVALIDADO"],
	CORRIGIDO: ["EM_VERIFICACAO", "INVALIDADO"],
	INVALIDADO: ["EM_VERIFICACAO", "CORRIGIDO"],
};
export function Dashboard() {
	const session = useRef(0);
	const [transcript, setTranscript] = useState("");
	const [token, setToken] = useState(""),
		[entry, setEntry] = useState("");
	const [items, setItems] = useState<Detail[]>([]),
		[selected, setSelected] = useState<Detail | null>(null);
	const [total, setTotal] = useState(0),
		[offset, setOffset] = useState(0),
		[filter, setFilter] = useState(""),
		[type, setType] = useState("");
	const [error, setError] = useState(""),
		[busy, setBusy] = useState(false),
		[note, setNote] = useState(""),
		[lastUpdated, setLastUpdated] = useState("");
	async function load(key = token, start = offset) {
		const epoch = session.current;
		setBusy(true);
		setError("");
		try {
			const page = PageSchema.parse(
				await (
					await request(key, `/incidents?limit=100&offset=${start}`)
				).json(),
			);
			if (epoch !== session.current) return;
			setItems(page.items);
			setTotal(page.total);
			setOffset(start);
			setToken(key);
			setEntry("");
			setLastUpdated(new Date().toLocaleTimeString("pt-BR"));
			setSelected((s) =>
				s
					? page.items.find((i) => i.incident_id === s.incident_id) || null
					: null,
			);
		} catch (e) {
			if (epoch === session.current) setError(String(e));
		} finally {
			if (epoch === session.current) setBusy(false);
		}
	}
	async function detail(id: string) {
		const epoch = session.current;
		setBusy(true);
		setError("");
		try {
			const result = DetailSchema.parse(
				await (await request(token, `/incidents/${id}`)).json(),
			);
			if (epoch !== session.current) return;
			setSelected(result);
			setTranscript("");
			setNote("");
		} catch (e) {
			if (epoch === session.current) setError(String(e));
		} finally {
			if (epoch === session.current) setBusy(false);
		}
	}
	async function analyze() {
		const epoch = session.current;
		if (!selected) return;
		setBusy(true);
		setError("");
		try {
			await request(token, `/incidents/${selected.incident_id}/analysis`, {
				method: "POST",
			});
			if (epoch !== session.current) return;
			await detail(selected.incident_id);
		} catch (e) {
			if (epoch === session.current) setError(String(e));
		} finally {
			if (epoch === session.current) setBusy(false);
		}
	}
	async function review(status: string) {
		const epoch = session.current;
		if (!selected) return;
		setBusy(true);
		setError("");
		try {
			await request(token, `/incidents/${selected.incident_id}/review`, {
				method: "POST",
				body: JSON.stringify({
					status,
					note,
					expected_status: selected.status,
				}),
			});
			if (epoch !== session.current) return;
			await load();
			if (epoch !== session.current) return;
			await detail(selected.incident_id);
		} catch (e) {
			if (epoch === session.current) setError(String(e));
		} finally {
			if (epoch === session.current) setBusy(false);
		}
	}
	async function transcribe(id: string) {
		if (!selected) return;
		const epoch = session.current;
		setBusy(true);
		setTranscript("");
		try {
			const response = await (
				await request(
					token,
					`/incidents/${selected.incident_id}/attachments/${id}/transcribe`,
					{ method: "POST" },
				)
			).json();
			if (epoch !== session.current) return;
			if (
				response.original_unchanged !== true ||
				response.transcript?.processing_status !== "transcribed" ||
				typeof response.transcript?.text !== "string"
			)
				throw new Error("Transcrição inválida.");
			setTranscript(response.transcript.text);
		} catch (e) {
			if (epoch === session.current)
				setError(e instanceof Error ? e.message : "Transcrição não concluída.");
		} finally {
			if (epoch === session.current) setBusy(false);
		}
	}
	async function download(id: string) {
		const epoch = session.current;
		if (!selected) return;
		setBusy(true);
		setError("");
		try {
			const response = await request(
				token,
				`/incidents/${selected.incident_id}/attachments/${id}`,
			);
			const blob = await response.blob();
			if (epoch !== session.current) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `anexo-${id}`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (e) {
			if (epoch === session.current) setError(String(e));
		} finally {
			if (epoch === session.current) setBusy(false);
		}
	}
	const visible = items.filter(
		(i) =>
			(!type || i.record_type === type) &&
			`${i.incident_id} ${i.description} ${i.location?.reference || ""} ${statusLabels[i.status]}`
				.toLocaleLowerCase("pt-BR")
				.includes(filter.toLocaleLowerCase("pt-BR")),
	);
	return (
		<main className="shell wide">
			<header className="masthead">
				<Brand />
				<div className="badge-row">
					<span className="pill">CENTRAL DEMONSTRATIVA</span>
					<a href="/">Aplicativo do cidadão ↗</a>
				</div>
			</header>
			<p className="eyebrow">Recebimento e verificação · acesso restrito</p>
			<h1>Informações que chegaram.</h1>
			<p className="muted">
				Registros persistidos no servidor. Nenhum atendimento real é acionado
				por esta central.
			</p>
			{error && (
				<p role="alert" className="status error">
					{error}
				</p>
			)}
			{token && <SystemDiagnostics key={token} token={token} />}
			{token && <MeshEnrollment key={`enrollment-${token}`} token={token} />}
			<DiagnosticsPanel />
			<CentralInstall />
			{!token ? (
				<form
					className="card login"
					onSubmit={(e) => {
						e.preventDefault();
						void load(entry, 0);
					}}
				>
					<p className="eyebrow">Acesso do operador</p>
					<h2>Entrar na demonstração</h2>
					<p>
						A chave permanece somente na memória desta página. Não use
						credenciais de outros serviços.
					</p>
					<label htmlFor="operator-key">Chave do operador</label>
					<input
						id="operator-key"
						type="password"
						autoComplete="off"
						value={entry}
						onChange={(e) => setEntry(e.target.value)}
						required
					/>
					<p>
						<button className="primary" disabled={busy}>
							Acessar registros
						</button>
					</p>
					<small>
						O responsável local configura a chave ao iniciar o servidor.
					</small>
				</form>
			) : (
				<>
					<div className="toolbar">
						<p className="muted">
							Última consulta: {lastUpdated}. Atualize para buscar novas
							ocorrências.
						</p>
						<div className="group">
							<button disabled={busy} onClick={() => void load()}>
								Atualizar registros
							</button>
							<button
								onClick={() => {
									session.current++;
									setBusy(false);
									setToken("");
									setItems([]);
									setSelected(null);
									setTranscript("");
									setNote("");
									setFilter("");
									setTotal(0);
									setError("");
								}}
							>
								Sair
							</button>
						</div>
					</div>
					<div className="stats">
						<div>
							<span className="count">{total}</span>
							<p>Recebidos no servidor</p>
						</div>
						<div>
							<span className="count">
								{items.filter((i) => i.status === "EM_VERIFICACAO").length}
							</span>
							<p>Em verificação nesta página</p>
						</div>
						<div>
							<span className="count">
								{
									items.filter(
										(i) => i.attachments.length > i.received_attachments.length,
									).length
								}
							</span>
							<p>Com anexos pendentes nesta página</p>
						</div>
					</div>
					<div className="notice">
						Ambiente de teste com dados fictícios. Receber um relato não
						confirma a situação nem o envio de ajuda. Revise as informações
						originais.
					</div>
					<div className="dashboard-grid">
						<section className="card">
							<h2>Ocorrências recebidas</h2>
							<label htmlFor="search">Buscar nesta página</label>
							<input
								id="search"
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
								placeholder="Relato, bairro, estado ou identificador"
							/>
							<label htmlFor="type">Tipo de registro</label>
							<select
								id="type"
								value={type}
								onChange={(e) => setType(e.target.value)}
							>
								<option value="">Todos os tipos</option>
								<option value="help">Pedido de socorro</option>
								<option value="witness">Ocorrência informada</option>
							</select>
							<p>
								<small>
									{visible.length} exibidos · página{" "}
									{Math.floor(offset / 100) + 1}
								</small>
							</p>
							{visible.length ? (
								visible.map((i) => (
									<button
										key={i.incident_id}
										className={`incident-button ${selected?.incident_id === i.incident_id ? "selected" : ""}`}
										onClick={() => void detail(i.incident_id)}
									>
										<span className="pill">
											{statusLabels[i.status] || i.status}
										</span>
										<strong>
											{i.description || "Registro mínimo sem relato"}
										</strong>
										<small>
											{i.location?.reference || "Localização não informada"} ·{" "}
											{new Date(i.server_received_at).toLocaleString("pt-BR")}
										</small>
										<div className="id">{i.incident_id}</div>
									</button>
								))
							) : (
								<p className="empty">Nenhuma ocorrência nesta consulta.</p>
							)}
							<div className="toolbar">
								<button
									disabled={offset === 0 || busy}
									onClick={() => void load(token, offset - 100)}
								>
									Anterior
								</button>
								<button
									disabled={offset + 100 >= total || busy}
									onClick={() => void load(token, offset + 100)}
								>
									Próxima
								</button>
							</div>
						</section>
						<section className="card" aria-live="polite">
							{selected ? (
								<>
									<p className="eyebrow">Registro original · dados fictícios</p>
									<div className="toolbar">
										<h2>
											{selected.record_type === "help"
												? "Pedido de socorro"
												: "Ocorrência informada"}
										</h2>
										<span className="pill">
											{statusLabels[selected.status]}
										</span>
									</div>
									<p className="id">{selected.incident_id}</p>
									<button
										disabled={busy}
										onClick={() =>
											void (async () => {
												const epoch = session.current;
												setBusy(true);
												try {
													await request(
														token,
														`/incidents/${selected.incident_id}/viewed`,
														{ method: "POST" },
													);
													if (epoch !== session.current) return;
													await detail(selected.incident_id);
												} catch (e) {
													setError(
														e instanceof Error
															? e.message
															: "Não foi possível registrar a visualização.",
													);
												} finally {
													if (epoch === session.current) setBusy(false);
												}
											})()
										}
									>
										Registrar que visualizei
									</button>
									{selected.mesh_deliveries.length > 0 && (
										<div className="notice">
											<strong>Recebimento por Rede Solidária</strong>
											{selected.mesh_deliveries.map((d) => (
												<p key={d.message_id}>
													{d.hops} saltos declarados em cadeia assinada ·{" "}
													{new Date(d.received_at).toLocaleString("pt-BR")}
												</p>
											))}
											<small>
												Assinaturas validadas; distância física e atendimento
												não comprovados. Anexos podem continuar pendentes na
												origem.
											</small>
										</div>
									)}
									<p className="preserve">
										{selected.description || "Relato escrito não informado."}
									</p>
									<div className="detail-row">
										<strong>Localização relatada</strong>
										<p>
											{selected.location?.reference ||
												"Referência não informada."}
										</p>
										{selected.location && (
											<small>
												Fonte: {selected.location.source} ·{" "}
												{new Date(selected.location.timestamp).toLocaleString(
													"pt-BR",
												)}
												<br />
												{selected.location.latitude !== null
													? `${selected.location.latitude}, ${selected.location.longitude} · precisão ±${selected.location.accuracy_m ?? "?"} m`
													: ""}{" "}
												·{" "}
												{selected.location.confirmed
													? "Marcada como confirmada na origem"
													: "Não verificada"}
											</small>
										)}
									</div>
									<div className="detail-row">
										<strong>Recebimento técnico</strong>
										<p>
											Criado:{" "}
											{new Date(selected.created_at).toLocaleString("pt-BR")}
											<br />
											Recebido:{" "}
											{new Date(selected.server_received_at).toLocaleString(
												"pt-BR",
											)}
										</p>
										<small>
											Horário do fato pode ser diferente. Atendimento não
											confirmado.
										</small>
									</div>
									<div className="detail-row">
										<strong>Anexos</strong>
										{transcript && (
											<p className="notice">
												Transcrição local não revisada: {transcript}
											</p>
										)}
										{selected.attachments.length ? (
											selected.attachments.map((a) => (
												<p key={a.attachment_id}>
													{a.kind === "audio" ? "Áudio" : "Foto"} ·{" "}
													{selected.received_attachments.some(
														(r) => r.id === a.attachment_id,
													) ? (
														<button
															disabled={busy}
															onClick={() => void download(a.attachment_id)}
														>
															Baixar arquivo recebido
														</button>
													) : (
														"ainda não recebido"
													)}
													{a.kind === "audio" &&
														selected.received_attachments.some(
															(r) => r.id === a.attachment_id,
														) && (
															<button
																disabled={busy}
																onClick={() => void transcribe(a.attachment_id)}
															>
																Transcrever áudio local
															</button>
														)}
												</p>
											))
										) : (
											<p>Nenhum anexo declarado.</p>
										)}
									</div>
									<div className="detail-row">
										<div className="toolbar">
											<h3>Organização assistida</h3>
											<button disabled={busy} onClick={() => void analyze()}>
												Analisar relato
											</button>
										</div>
										<small>
											Processamento opcional, sempre sujeito a revisão humana.
										</small>
										{selected.analyses.length ? (
											selected.analyses.map((a) => (
												<details
													key={a.analysis_id}
													open={a === selected.analyses[0]}
												>
													<summary>
														{a.processing_status === "model"
															? "Modelo de IA"
															: a.processing_status === "fallback"
																? "Modelo falhou · contingência por regras"
																: "Regras determinísticas · sem modelo generativo"}
													</summary>
													<p>
														Categoria sugerida:{" "}
														{a.suggested_category.replaceAll("_", " ")}
														<br />
														Pessoas mencionadas:{" "}
														{a.extracted_information.people_mentioned ??
															"não determinado"}
														<br />
														Confiança:{" "}
														{a.confidence === "low" ? "baixa" : "moderada"} ·
														não calibrada
													</p>
													{a.extracted_information.people_evidence && (
														<p>
															Evidência: “
															{a.extracted_information.people_evidence}”
														</p>
													)}
													<p>
														Condições relatadas:{" "}
														{a.extracted_information.conditions.join("; ") ||
															"não extraídas"}
													</p>
													<p>Lacunas: {a.missing_information.join("; ")}</p>
													<ul>
														{a.limitations.map((l, i) => (
															<li key={i}>{l}</li>
														))}
													</ul>
													{a.possible_duplicates.length > 0 && (
														<>
															<h3>Relatos possivelmente relacionados</h3>
															{a.possible_duplicates.map((d) => (
																<p key={d.incident_id} className="id">
																	{d.incident_id}
																	<br />
																	{d.reasons.join("; ")} · escore heurístico{" "}
																	{d.score}
																</p>
															))}
															<small>
																Nenhuma ocorrência foi fundida ou excluída.
															</small>
														</>
													)}
													<small>
														{a.model_name} ·{" "}
														{new Date(a.processed_at).toLocaleString("pt-BR")}
													</small>
												</details>
											))
										) : (
											<p>
												Nenhuma análise solicitada. O relato já está salvo e
												disponível.
											</p>
										)}
									</div>
									<div className="detail-row">
										<h3>Histórico preservado</h3>
										<ul className="list-clean">
											{selected.history.map((h, i) => (
												<li key={i}>
													<strong>{statusLabels[h.status]}</strong> ·{" "}
													{new Date(h.at).toLocaleString("pt-BR")}
													<br />
													{h.note}
													<br />
													<small>{h.actor}</small>
												</li>
											))}
										</ul>
									</div>
									<details>
										<summary>Registrar revisão ou correção</summary>
										<p>
											Esta ação fica no histórico. Uma correção não substitui o
											relato original.
										</p>
										<label htmlFor="note">
											Justificativa ou texto da correção
										</label>
										<textarea
											id="note"
											minLength={5}
											maxLength={2000}
											value={note}
											onChange={(e) => setNote(e.target.value)}
										/>
										<div className="group">
											{(transitions[selected.status] || []).map((s) => (
												<button
													key={s}
													disabled={busy || note.trim().length < 5}
													onClick={() => void review(s)}
												>
													{statusLabels[s]}
												</button>
											))}
										</div>
									</details>
								</>
							) : (
								<div className="empty">
									<h2>Selecione um registro</h2>
									<p>
										O relato original, os anexos efetivamente recebidos e o
										histórico aparecerão aqui.
									</p>
								</div>
							)}
						</section>
					</div>
				</>
			)}
			<footer className="footer">
				Preparação técnica privada · sem integração com serviços oficiais ·
				revisão humana pendente
			</footer>
		</main>
	);
}
