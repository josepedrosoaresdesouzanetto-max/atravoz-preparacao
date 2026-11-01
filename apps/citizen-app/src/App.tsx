import { useEffect, useMemo, useState } from "react";
import { Brand } from "../../shared/Brand";
import {
	type Incident,
	type Location,
	statusLabels,
} from "../../../packages/contracts/src";
import {
	LocalStore,
	type LocalRecord,
	type MediaItem,
} from "./features/offline-storage/store";
import { SyncQueue } from "./features/sync/queue";
import { AudioCapture, preparePhoto } from "./features/media/capture";
import { locate } from "./features/location/location";

const store = new LocalStore();
type Draft = {
	description: string;
	reference: string;
	location: Location | null;
	media: MediaItem[];
};
const emptyDraft: Draft = {
	description: "",
	reference: "",
	location: null,
	media: [],
};
function MediaPreview({ item }: { item: MediaItem }) {
	const [url, setUrl] = useState("");
	useEffect(() => {
		const next = URL.createObjectURL(item.blob);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [item]);
	return item.manifest.kind === "audio" ? (
		<audio controls src={url} aria-label="Ouvir gravação" />
	) : (
		<img className="preview" src={url} alt="Prévia da fotografia selecionada" />
	);
}
function LocalCard({ record }: { record: LocalRecord }) {
	const [previews, setPreviews] = useState<MediaItem[]>([]);
	return (
		<article className="record" data-testid="local-record">
			<div className="toolbar">
				<strong>
					{record.incident.record_type === "help"
						? "Pedido de socorro"
						: "Ocorrência informada"}
				</strong>
				<span className="pill">{statusLabels[record.status]}</span>
			</div>
			<p>
				{record.incident.description || "Registro mínimo · sem relato escrito"}
			</p>
			<small>
				{new Date(record.incident.created_at).toLocaleString("pt-BR")} · Dados
				fictícios
			</small>
			<p className="id">ID: {record.incident.incident_id}</p>
			{record.receipt && (
				<p className="success">
					Recebimento confirmado pelo protótipo. Atendimento não confirmado.
				</p>
			)}
			{record.incident.attachments.map((a) => (
				<p key={a.attachment_id}>
					{a.kind === "audio" ? "Áudio" : "Foto"}:{" "}
					{record.attachment_receipts[a.attachment_id]
						? "recebido pelo servidor"
						: "salvo no aparelho · envio pendente"}
				</p>
			))}
			{record.last_error && (
				<p className="error status">
					{record.last_error}
					{record.blocked
						? " Reenvio automático suspenso; procure o responsável pelo protótipo com este ID."
						: ""}
				</p>
			)}
			<details
				onToggle={async (e) => {
					if (e.currentTarget.open && record.incident.attachments.length)
						try {
							const items = await Promise.all(
								record.incident.attachments.map((a) =>
									store.media(a.attachment_id),
								),
							);
							setPreviews(items.filter((v): v is MediaItem => !!v));
						} catch {
							setPreviews([]);
						}
				}}
			>
				<summary>Comprovantes e arquivos locais</summary>
				<p>
					Tentativas: {record.attempts}. Última:{" "}
					{record.last_attempt
						? new Date(record.last_attempt).toLocaleString("pt-BR")
						: "nenhuma"}
					.
				</p>
				<p>
					Localização:{" "}
					{record.incident.location?.reference ||
						(record.incident.location
							? `${record.incident.location.latitude}, ${record.incident.location.longitude}`
							: "não informada")}
					.
				</p>
				{record.receipt && (
					<p className="id">
						Recibo: {record.receipt.receipt_id}
						<br />
						Recebido:{" "}
						{new Date(record.receipt.server_received_at).toLocaleString(
							"pt-BR",
						)}
					</p>
				)}
				<ul>
					{record.history.map((h, i) => (
						<li key={i}>
							{new Date(h.at).toLocaleTimeString("pt-BR")} ·{" "}
							{statusLabels[h.status]}
						</li>
					))}
				</ul>
				{previews.map((item) => (
					<MediaPreview key={item.manifest.attachment_id} item={item} />
				))}
				<p className="muted">
					Para corrigir um registro enviado, informe este ID ao operador da
					demonstração. O original será preservado no histórico.
				</p>
			</details>
		</article>
	);
}
export function App() {
	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const [records, setRecords] = useState<LocalRecord[]>([]);
	const [ready, setReady] = useState(false),
		[busy, setBusy] = useState(false),
		[mediaBusy, setMediaBusy] = useState(false);
	const [message, setMessage] = useState(""),
		[error, setError] = useState("");
	const [survival, setSurvival] = useState(false),
		[offlineReady, setOfflineReady] = useState(false),
		[recording, setRecording] = useState(false);
	const [online, setOnline] = useState(navigator.onLine);
	const recorder = useMemo(() => new AudioCapture(), []);
	const queue = useMemo(
		() =>
			new SyncQueue(store, fetch, () =>
				window.dispatchEvent(new Event("records-changed")),
			),
		[],
	);
	const refresh = () =>
		store
			.list()
			.then(setRecords)
			.catch(() =>
				setError(
					"Não foi possível ler o armazenamento. Não apague os dados do navegador.",
				),
			);
	useEffect(() => {
		Promise.all([
			store.setting<Draft>("draft"),
			store.setting<boolean>("survival"),
		])
			.then(([d, s]) => {
				if (d) setDraft(d);
				setSurvival(!!s);
				setReady(true);
			})
			.catch(() =>
				setError("Armazenamento indisponível. O registro ainda não foi salvo."),
			);
		void refresh();
		const update = () => {
			void refresh();
		};
		window.addEventListener("records-changed", update);
		if ("serviceWorker" in navigator && import.meta.env.PROD)
			navigator.serviceWorker
				.register("/sw.js")
				.then(() => navigator.serviceWorker.ready)
				.then(() => setOfflineReady(true))
				.catch(() =>
					setError(
						"Cache offline não foi preparado. Mantenha esta página aberta e tente novamente com conexão.",
					),
				);
		return () => {
			window.removeEventListener("records-changed", update);
			recorder.stop();
		};
	}, [recorder]);
	useEffect(() => {
		if (!ready) return;
		const timer = setTimeout(
			() =>
				store
					.setSetting("draft", draft)
					.catch(() =>
						setError(
							"Falha ao guardar o rascunho. Tente salvar o registro mínimo.",
						),
					),
			300,
		);
		return () => clearTimeout(timer);
	}, [draft, ready]);
	useEffect(() => {
		if (!ready) return;
		const sync = () => {
			setOnline(navigator.onLine);
			if (navigator.onLine)
				void queue
					.run()
					.catch(() =>
						setError(
							"Falha no armazenamento da fila. Seus registros precisam de revisão.",
						),
					);
		};
		const visible = () => {
			if (document.visibilityState === "visible") sync();
		};
		const offline = () => setOnline(false);
		window.addEventListener("online", sync);
		window.addEventListener("offline", offline);
		document.addEventListener("visibilitychange", visible);
		const timer = setInterval(visible, survival ? 60000 : 15000);
		sync();
		return () => {
			clearInterval(timer);
			window.removeEventListener("online", sync);
			window.removeEventListener("offline", offline);
			document.removeEventListener("visibilitychange", visible);
		};
	}, [queue, ready, survival]);
	async function save(type: "help" | "witness") {
		setBusy(true);
		setError("");
		setMessage("Salvando neste aparelho…");
		try {
			const now = new Date().toISOString();
			const location = draft.location
				? {
						...draft.location,
						reference: draft.reference || draft.location.reference,
					}
				: draft.reference.trim()
					? {
							source: "manual" as const,
							reference: draft.reference,
							latitude: null,
							longitude: null,
							accuracy_m: null,
							timestamp: now,
							confirmed: false,
						}
					: null;
			const incident: Incident = {
				schema_version: 1,
				incident_id: crypto.randomUUID(),
				created_at: now,
				updated_at: now,
				record_type: type,
				description: draft.description,
				synthetic: true,
				location,
				origin_device_id: null,
				attachments: draft.media.map((m) => m.manifest),
			};
			await store.save(incident, draft.media);
			setDraft(emptyDraft);
			await refresh();
			setMessage(
				"Salvo neste aparelho. A entrega depende de conexão e confirmação do servidor.",
			);
			// The minimal record is durable before optional persistence requests or network work.
			if (navigator.storage?.persist)
				void navigator.storage.persist().catch(() => false);
			if (navigator.onLine)
				void queue
					.run()
					.catch(() =>
						setError("Registro salvo; falha ao atualizar a fila de envio."),
					);
		} catch (e) {
			setMessage("");
			setError(
				`Não foi possível salvar. Preserve esta tela e tente novamente. ${e instanceof Error ? e.message : ""}`,
			);
		} finally {
			setBusy(false);
		}
	}
	async function photo(file?: File) {
		if (!file) return;
		setMediaBusy(true);
		setError("");
		try {
			const item = await preparePhoto(file);
			setDraft((d) => ({
				...d,
				media: [...d.media.filter((m) => m.manifest.kind !== "photo"), item],
			}));
		} catch (e) {
			setError(String(e));
		} finally {
			setMediaBusy(false);
		}
	}
	async function audio() {
		setError("");
		if (recording) {
			recorder.stop();
			return;
		}
		try {
			await recorder.start(
				(item) => {
					setDraft((d) => ({
						...d,
						media: [
							...d.media.filter((m) => m.manifest.kind !== "audio"),
							item,
						],
					}));
					setRecording(false);
				},
				(e) => {
					setError(e);
					setRecording(false);
				},
			);
			setRecording(true);
		} catch {
			setError(
				"Microfone indisponível ou permissão negada. Você pode registrar sem áudio.",
			);
			setRecording(false);
		}
	}
	const pending = records.filter(
		(r) =>
			!r.receipt ||
			r.incident.attachments.some(
				(a) => !r.attachment_receipts[a.attachment_id],
			),
	).length;
	return (
		<main className="shell">
			<header className="masthead">
				<Brand />
				<span className="pill">PREPARAÇÃO PRIVADA</span>
			</header>
			<p className="eyebrow">Recife e região metropolitana · Demonstração</p>
			<h1>
				A informação encontra
				<br />
				outro caminho.
			</h1>
			<p className="muted">
				Registre agora. O aparelho guarda a informação para tentar enviar quando
				houver conexão.
			</p>
			<aside className="notice">
				<strong>Este protótipo não aciona socorro.</strong>
				<p>
					Use apenas dados fictícios. Em uma emergência real, procure os canais
					oficiais: <a href="tel:193">Bombeiros 193</a> ou{" "}
					<a href="tel:199">Defesa Civil 199</a>.
				</p>
			</aside>
			<div className="actions">
				<button
					className="big-action urgent"
					disabled={!ready || busy || recording || mediaBusy}
					onClick={() => void save("help")}
				>
					PRECISO DE SOCORRO <small>Salvar um pedido neste aparelho ↗</small>
				</button>
				<button
					className="big-action primary"
					disabled={!ready || busy || recording || mediaBusy}
					onClick={() => void save("witness")}
				>
					INFORMAR UMA OCORRÊNCIA{" "}
					<small>Registrar uma situação que observei ↗</small>
				</button>
			</div>
			<p className="muted">
				<small>
					Um toque salva o registro mínimo. Nome, foto, áudio e GPS são
					opcionais.
				</small>
			</p>
			<div role="status" aria-live="polite">
				{message && <p className="status">{message}</p>}
			</div>
			{error && (
				<p role="alert" className="status error">
					{error}
				</p>
			)}
			<details className="card">
				<summary>Adicionar detalhes antes de salvar (opcional)</summary>
				<label htmlFor="description">O que está acontecendo?</label>
				<textarea
					id="description"
					maxLength={4000}
					rows={4}
					placeholder="Exemplo fictício: três pessoas ilhadas no telhado…"
					value={draft.description}
					onChange={(e) =>
						setDraft((d) => ({ ...d, description: e.target.value }))
					}
				/>
				<small>
					{draft.description.length}/4000 caracteres. Rascunho guardado neste
					navegador.
				</small>
				<label htmlFor="reference">Bairro ou ponto de referência</label>
				<input
					id="reference"
					maxLength={240}
					value={draft.reference}
					onChange={(e) =>
						setDraft((d) => ({ ...d, reference: e.target.value }))
					}
					placeholder="Pode deixar em branco"
				/>
				<div className="toolbar">
					<button
						type="button"
						onClick={async () => {
							try {
								setDraft((d) => ({ ...d, location: null }));
								const l = await locate();
								setDraft((d) => ({ ...d, location: l }));
							} catch (e) {
								setError(String(e));
							}
						}}
					>
						Usar minha localização
					</button>
					<small>
						{draft.location
							? `GPS obtido às ${new Date(draft.location.timestamp).toLocaleTimeString("pt-BR")} · precisão ±${Math.round(draft.location.accuracy_m || 0)} m`
							: "Localização não informada"}
					</small>
				</div>
				{draft.location && (
					<button
						className="quiet"
						onClick={() => setDraft((d) => ({ ...d, location: null }))}
					>
						Remover coordenadas
					</button>
				)}
				<hr className="divider" />
				<button onClick={() => void audio()} aria-pressed={recording}>
					{recording ? "Parar gravação" : "Gravar áudio · até 30 segundos"}
				</button>
				{recording && (
					<p role="status">
						● Gravando. Pare a gravação para incluir o áudio no registro.
					</p>
				)}
				<label htmlFor="photo">Fotografia opcional</label>
				<input
					id="photo"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onChange={(e) => void photo(e.target.files?.[0])}
				/>
				<small>
					A foto será reduzida para envio. Uma cópia original fica neste
					aparelho; o arquivo escolhido não é apagado.
				</small>
				{mediaBusy && <p role="status">Preparando foto…</p>}
				{draft.media.map((m) => (
					<div key={m.manifest.attachment_id}>
						<MediaPreview item={m} />
						<small>
							{m.manifest.kind === "audio" ? "Áudio" : "Foto"} pronto para
							salvar · {Math.ceil(m.blob.size / 1024)} KB
						</small>
						<button
							className="quiet"
							onClick={() =>
								setDraft((d) => ({
									...d,
									media: d.media.filter((x) => x !== m),
								}))
							}
						>
							Remover {m.manifest.kind === "audio" ? "áudio" : "foto"}
						</button>
					</div>
				))}
				<p className="muted">
					Depois de adicionar os detalhes, toque em uma das duas ações acima.
				</p>
			</details>
			<section className="card" aria-labelledby="saved-title">
				<div className="toolbar">
					<div>
						<p className="eyebrow">Neste aparelho</p>
						<h2 id="saved-title">
							Registros preservados{" "}
							<span className="pill">{records.length}</span>
						</h2>
					</div>
					<button
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							try {
								await queue.run(true);
								await refresh();
							} catch {
								setError(
									"Não foi possível sincronizar. Registros preservados.",
								);
							} finally {
								setBusy(false);
							}
						}}
					>
						Tentar enviar agora
					</button>
				</div>
				<p className="muted">
					{pending} com envio pendente ·{" "}
					{online
						? "Rede detectada; entrega depende do servidor."
						: "Sem conexão detectada."}
				</p>
				{records.length ? (
					records.map((r) => (
						<LocalCard key={r.incident.incident_id} record={r} />
					))
				) : (
					<p className="empty">
						Seus registros aparecerão aqui após o salvamento.
					</p>
				)}
			</section>
			<label className="check">
				<input
					type="checkbox"
					checked={survival}
					onChange={(e) => {
						setSurvival(e.target.checked);
						void store
							.setSetting("survival", e.target.checked)
							.catch(() => setError("Não foi possível guardar a preferência."));
					}}
				/>
				Modo Sobrevivência · reduzir verificações automáticas
			</label>
			<p className="muted">
				<small>
					{offlineReady
						? "Aplicativo preparado para reabrir sem conexão."
						: "Abertura offline depende da preparação inicial do cache."}{" "}
					O navegador pode suspender o envio em segundo plano. Não limpe os
					dados do navegador enquanto houver registros pendentes.
				</small>
			</p>
			<footer className="footer">
				<div className="toolbar">
					<span>Recebimento não significa atendimento.</span>
					<a href="/central.html">Central demonstrativa ↗</a>
				</div>
				<p>
					Bluetooth: transferência física ainda não implementada nem validada.
					Nenhum registro é enviado para aparelhos próximos nesta versão.
				</p>
			</footer>
		</main>
	);
}
