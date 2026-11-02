import BluetoothPanel from "./BluetoothPanel";
import { apiFetch, isAndroid } from "../../../../shared/native";
import { useEffect, useRef, useState } from "react";
import { MeshNode } from "../../../../../packages/mesh-core/src/node";
import {
	MeshStore,
	type MeshMetrics,
	type MeshRow,
} from "../../../../../packages/mesh-core/src/storage";
import { ManualWebRTC } from "../../../../../packages/mesh-core/src/webrtc";
import {
	createIdentity,
	digest,
	sign,
	verifyMember,
} from "../../../../../packages/mesh-core/src/security";
import {
	defaultPolicy,
	PolicySchema,
	type ResourcePolicy,
} from "../../../../../packages/mesh-core/src/resource-policy";
import {
	seconds,
	type Trust,
} from "../../../../../packages/mesh-core/src/protocol";
import { ReceiptSchema } from "../../../../../packages/contracts/src";
import type { SyncQueue } from "../sync/queue";
import { internetAllowed } from "../../../../../packages/mesh-core/src/resource-policy";
import { LocalStore, setStatus } from "../offline-storage/store";

const meshStore = new MeshStore();
async function api(path: string, body?: unknown) {
	const response = await apiFetch(`/api/v1/mesh/${path}`, {
		method: body ? "POST" : "GET",
		headers: body ? { "Content-Type": "application/json" } : {},
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(15000),
	});
	if (!response.ok)
		throw new Error(
			`Rede Solidária indisponível (${response.status}). Os registros próprios continuam salvos.`,
		);
	return response.json();
}
export default function MeshPanel({
	store,
	changed,
	survival,
	syncQueue,
}: {
	store: LocalStore;
	changed: () => Promise<unknown>;
	survival: boolean;
	syncQueue: SyncQueue;
}) {
	const [node, setNode] = useState<MeshNode | null>(null),
		[policy, setPolicy] = useState<ResourcePolicy>({ ...defaultPolicy }),
		[rows, setRows] = useState<MeshRow[]>([]),
		[metrics, setMetrics] = useState<MeshMetrics | null>(null);
	const [invite, setInvite] = useState(""),
		[fingerprint, setFingerprint] = useState(""),
		[input, setInput] = useState(""),
		[output, setOutput] = useState(""),
		[message, setMessage] = useState(""),
		[busy, setBusy] = useState(false),
		[wifi, setWifi] = useState(false),
		[connected, setConnected] = useState(false),
		[battery, setBattery] = useState<number | null>(null);
	const transport = useRef<ManualWebRTC | null>(null);
	const refresh = async () => {
		setRows(await meshStore.rows());
		setMetrics(await meshStore.metrics());
	};
	const bind = (n: MeshNode) => {
		n.onChange = refresh;
		n.onServerDelivery = async (id, r) => {
			await store.update(id, (row) => {
				const receipt = ReceiptSchema.parse({
					incident_id: id,
					receipt_id: r.receipt_id,
					server_received_at: r.server_received_at,
					status: "RECEBIDO_SERVIDOR",
					code: "PERSISTED",
					message:
						"Recebimento técnico confirmado por recibo assinado da central.",
					attachment_ids_received: [],
				});
				if (row.receipt && row.receipt.receipt_id !== receipt.receipt_id)
					throw new Error("Recibos divergentes; preserve os dados.");
				row.receipt = receipt;
				row.last_error = null;
				row.blocked = false;
				row.next_attempt = 0;
				setStatus(row, "RECEBIDO_SERVIDOR");
			});
			await changed();
		};
		return n;
	};
	useEffect(() => {
		let active = true;
		void (async () => {
			const p = PolicySchema.parse(
					(await meshStore.setting("policy")) || defaultPolicy,
				),
				identity = await meshStore.identity(),
				trust = await meshStore.trust();
			if (!active) return;
			setPolicy(p);
			if (identity && trust) {
				const restored = bind(new MeshNode(meshStore, identity, trust));
				setNode(restored);
				for (const row of await meshStore.rows())
					if (row.ownIncidentId && row.serverReceipt)
						await restored.receiveServerReceipt(row.serverReceipt);
			}
			await refresh();
		})().catch(() =>
			setMessage(
				"Armazenamento mesh indisponível. O envio direto permanece separado.",
			),
		);
		return () => {
			active = false;
			transport.current?.close();
		};
	}, []);
	useEffect(() => {
		let active = true;
		const nav = navigator as Navigator & {
			getBattery?: () => Promise<{
				level: number;
				addEventListener: (type: string, fn: () => void) => void;
				removeEventListener: (type: string, fn: () => void) => void;
			}>;
		};
		let cleanup = () => {};
		if (nav.getBattery)
			void nav
				.getBattery()
				.then((b) => {
					const update = () => {
						if (active) setBattery(Math.round(b.level * 100));
					};
					update();
					b.addEventListener("levelchange", update);
					cleanup = () => b.removeEventListener("levelchange", update);
				})
				.catch(() => {});
		const reset = () => setWifi(false);
		window.addEventListener("offline", reset);
		window.addEventListener("online", reset);
		return () => {
			active = false;
			cleanup();
			window.removeEventListener("offline", reset);
			window.removeEventListener("online", reset);
		};
	}, []);
	useEffect(() => {
		if (!node) return;
		node.policy = { ...policy, paused: policy.paused || survival };
		node.signal = {
			network: !navigator.onLine ? "offline" : wifi ? "wifi" : "unknown",
			batteryPercent: battery,
		};
		if (
			!policy.enabled ||
			policy.paused ||
			survival ||
			(battery !== null && battery < policy.minBatteryPercent)
		) {
			transport.current?.close();
			transport.current = null;
			setConnected(false);
		}
	}, [node, policy, survival, wifi, battery]);
	const prepare = async (n: MeshNode) => {
		for (const r of await store.list())
			if (!r.receipt) await n.queueOwn(r.incident, r.write_key);
	};
	const sendMesh = async (n: MeshNode) => {
		await n.gateway(
			async (envelope, credential, proof) =>
				(await api("deliveries", { envelope, credential, proof })).proof,
		);
		await changed();
	};
	const gateway = async (n: MeshNode) => {
		internetAllowed(n.policy, n.signal);
		await syncQueue.run();
		if (syncQueue.relayFailure) throw syncQueue.relayFailure;
	};
	useEffect(() => {
		if (!node) return;
		const hook = async () => {
			if (
				!node.policy.enabled ||
				node.policy.paused ||
				(!wifi && !node.policy.allowMobile) ||
				!navigator.onLine
			)
				return;
			try {
				await prepare(node);
				await sendMesh(node);
				await refresh();
			} catch (e) {
				setMessage(e instanceof Error ? e.message : "Transmissão adiada.");
				throw e;
			}
		};
		syncQueue.beforeAttachments = hook;
		return () => {
			if (syncQueue.beforeAttachments === hook)
				syncQueue.beforeAttachments = null;
		};
	}, [node, policy, survival, wifi, syncQueue]);

	useEffect(() => {
		if (!node || !policy.enabled || policy.paused || survival) return;
		let running = false;
		const tick = async () => {
			if (running || document.visibilityState !== "visible") return;
			running = true;
			try {
				await meshStore.maintain(seconds());
				await prepare(node);
				if (navigator.onLine && (wifi || policy.allowMobile))
					await gateway(node);
				await refresh();
			} catch (e) {
				setMessage(e instanceof Error ? e.message : "Operação mesh adiada.");
			} finally {
				running = false;
			}
		};
		const timer = setInterval(() => void tick(), policy.searchIntervalMs);
		return () => clearInterval(timer);
	}, [node, policy, survival, wifi]);
	const run = async (action: () => Promise<void>) => {
		setBusy(true);
		setMessage("");
		try {
			await action();
			await refresh();
		} catch (e) {
			setMessage(
				e instanceof Error ? e.message : "Operação mesh não concluída.",
			);
		} finally {
			setBusy(false);
		}
	};
	const change = async (p: ResourcePolicy) => {
		const checked = PolicySchema.parse(p);
		if (node) node.policy = { ...checked, paused: checked.paused || survival };
		setPolicy(checked);
		if (!checked.enabled || checked.paused) {
			transport.current?.close();
			setConnected(false);
		}
		await meshStore.set("policy", checked);
	};
	return (
		<section className="card mesh-panel" aria-labelledby="mesh-title">
			<h2 id="mesh-title">
				Rede Solidária <small>· experimental</small>
			</h2>
			<p>
				Carregue cópias cifradas de pedidos entre participantes autorizados. Só
				a central pode abrir o conteúdo.{" "}
				{isAndroid()
					? "Use Bluetooth com o aplicativo aberto e participantes previamente autorizados."
					: "A conexão WebRTC exige troca manual de códigos, navegador aberto e uma rede local compatível."}
			</p>
			<p className="notice">
				{isAndroid()
					? "Descoberta Bluetooth iniciada pelo usuário; comunicação física ainda aguarda validação em celulares."
					: "Bluetooth está disponível apenas no APK experimental. Wi-Fi Direct não está implementado."}
				Entrega por intermediário não confirma atendimento. Não use dados reais
				nesta demonstração.
			</p>
			{
				<details>
					<summary>
						{node
							? "Renovar participação com novo convite"
							: "Preparar este aparelho com um convite da equipe"}
					</summary>
					<p>
						Faça esta preparação com internet antes do exercício. Confira o
						identificador da autoridade por um canal confiável com a equipe. O
						convite é de uso único e dura 10 minutos.
					</p>
					<label>
						Identificador da autoridade
						<input
							aria-label="Identificador da autoridade"
							value={fingerprint}
							onChange={(e) => setFingerprint(e.target.value.trim())}
							maxLength={43}
						/>
					</label>
					<label>
						Convite de participação
						<input
							aria-label="Convite de participação"
							value={invite}
							onChange={(e) => setInvite(e.target.value.trim())}
							maxLength={100}
						/>
					</label>
					<button
						disabled={busy || !invite || fingerprint.length !== 43}
						onClick={() =>
							void run(async () => {
								const trust: Trust = await api("trust");
								if (
									trust.authority_id !== fingerprint ||
									(await digest(
										JSON.stringify({
											crv: trust.signing_jwk.crv,
											kty: trust.signing_jwk.kty,
											x: trust.signing_jwk.x,
											y: trust.signing_jwk.y,
										}),
									)) !== fingerprint
								)
									throw new Error(
										"Autoridade não corresponde ao identificador informado.",
									);
								if (node && node.trust.authority_id !== trust.authority_id)
									throw new Error("Autoridade mudou; configuração preservada.");
								const identity = node?.identity || (await createIdentity());
								const proof = await sign(
									{
										kind: "mesh-enrollment",
										invitation_hash: await digest(invite),
										subject: identity.subject,
										at: seconds(),
									},
									identity.privateKey,
								);
								identity.credential = (
									await api("enroll", {
										invitation: invite,
										public_jwk: identity.publicJwk,
										proof,
									})
								).credential;
								await verifyMember(identity.credential, trust);
								await meshStore.set("identity", identity);
								await meshStore.set("trust", trust);
								setNode(bind(new MeshNode(meshStore, identity, trust)));
								setInvite("");
								setMessage(
									"Aparelho preparado. A participação continua desligada até você ativar.",
								);
							})
						}
					>
						Preparar participação
					</button>
				</details>
			}
			{node && (
				<>
					<p>
						Participante autorizado · credencial de até 24 horas. Revogações só
						chegam quando a lista é atualizada com internet.
					</p>
					<div className="toolbar">
						<button
							disabled={busy}
							onClick={() =>
								void run(async () => {
									const trust: Trust = await api("trust");
									if (
										trust.authority_id !== node.trust.authority_id ||
										JSON.stringify(trust.signing_jwk) !==
											JSON.stringify(node.trust.signing_jwk) ||
										JSON.stringify(trust.encryption_jwk) !==
											JSON.stringify(node.trust.encryption_jwk)
									)
										throw new Error(
											"Autoridade mudou: confira com a equipe; configuração preservada.",
										);
									node.trust = trust;
									await meshStore.set("trust", trust);
									try {
										await verifyMember(node.identity.credential, trust);
									} catch (e) {
										await change({ ...policy, paused: true });
										throw e;
									}
									setMessage("Credenciais e revogações atualizadas.");
								})
							}
						>
							Atualizar autorização
						</button>
					</div>
					<small>ID público desta instalação: {node.identity.subject}</small>
				</>
			)}
			<label className="check">
				<input
					type="checkbox"
					checked={policy.enabled}
					disabled={!node}
					onChange={(e) =>
						void run(() => change({ ...policy, enabled: e.target.checked }))
					}
				/>
				Participar da Rede Solidária
			</label>
			<label className="check">
				<input
					type="checkbox"
					checked={policy.paused}
					disabled={!policy.enabled}
					onChange={(e) =>
						void run(() => change({ ...policy, paused: e.target.checked }))
					}
				/>
				Pausar retransmissões
			</label>
			{survival && <p>Modo sobrevivência: retransmissões pausadas.</p>}
			<details>
				<summary>Limites de bateria, espaço e internet</summary>
				<p>
					Dados móveis bloqueados por padrão. O navegador não identifica Wi-Fi
					com segurança; confirme a rede em cada sessão. Bateria:{" "}
					{battery === null ? "não informada pelo navegador" : `${battery}%`}.
				</p>
				<label className="check">
					<input
						type="checkbox"
						checked={wifi}
						onChange={(e) => setWifi(e.target.checked)}
					/>
					Conferi nas configurações: estou em Wi-Fi nesta sessão
				</label>
				<label className="check">
					<input
						type="checkbox"
						checked={policy.allowMobile}
						onChange={(e) =>
							void run(() =>
								change({ ...policy, allowMobile: e.target.checked }),
							)
						}
					/>
					Permitir internet móvel ou de tipo desconhecido dentro da cota
				</label>
				<label>
					Cota diária de internet
					<select
						value={policy.dailyInternetBytes}
						onChange={(e) =>
							void run(() =>
								change({
									...policy,
									dailyInternetBytes: Number(e.target.value),
								}),
							)
						}
					>
						<option value={262144}>256 KiB</option>
						<option value={1048576}>1 MiB</option>
						<option value={5242880}>5 MiB</option>
					</select>
				</label>
				<label>
					Espaço para cópias de terceiros
					<select
						value={policy.relayBytes}
						onChange={(e) =>
							void run(() =>
								change({ ...policy, relayBytes: Number(e.target.value) }),
							)
						}
					>
						<option value={262144}>256 KiB</option>
						<option value={2097152}>2 MiB</option>
						<option value={8388608}>8 MiB</option>
					</select>
				</label>
				<label>
					Pausar abaixo de bateria
					<select
						value={policy.minBatteryPercent}
						onChange={(e) =>
							void run(() =>
								change({
									...policy,
									minBatteryPercent: Number(e.target.value),
								}),
							)
						}
					>
						<option value={20}>20%</option>
						<option value={40}>40%</option>
						<option value={60}>60%</option>
					</select>
				</label>
				<label>
					Revisar fila local a cada
					<select
						value={policy.searchIntervalMs}
						onChange={(e) =>
							void run(() =>
								change({ ...policy, searchIntervalMs: Number(e.target.value) }),
							)
						}
					>
						<option value={30000}>30 segundos</option>
						<option value={60000}>60 segundos</option>
						<option value={300000}>5 minutos</option>
					</select>
				</label>
				<p>
					Até {policy.maxMessages} cópias de terceiros; {policy.maxCopies}{" "}
					destinos por aparelho; {policy.maxAttempts} tentativas por envelope;{" "}
					{policy.perEncounter} mensagens por encontro. A cota inclui reserva de
					metadados, não mede a cobrança da operadora.
				</p>
			</details>
			{node && policy.enabled && !policy.paused && !survival && (
				<details>
					<summary>Conectar dois participantes</summary>
					<p>
						1. Crie uma oferta e leve o código ao outro aparelho. 2. No outro
						aparelho, cole e aceite a oferta; leve a resposta de volta. 3. Cole
						a resposta no primeiro e finalize. Códigos expiram em 2 minutos e
						revelam metadados de conexão. Depois, cada lado pode enviar sua fila
						e devolver recibos.
					</p>
					<div className="toolbar">
						<button
							disabled={busy}
							onClick={() =>
								void run(async () => {
									transport.current?.close();
									setOutput("");
									setConnected(false);
									await prepare(node);
									transport.current = new ManualWebRTC(node);
									setOutput(await transport.current.createOffer());
									setConnected(false);
								})
							}
						>
							Criar oferta
						</button>
						<button
							disabled={busy || !input}
							onClick={() =>
								void run(async () => {
									transport.current?.close();
									setOutput("");
									setConnected(false);
									await prepare(node);
									transport.current = new ManualWebRTC(node);
									setOutput(await transport.current.acceptOffer(input));
									void transport.current
										.ready()
										.then(() => setConnected(true))
										.catch(() => setConnected(false));
								})
							}
						>
							Aceitar oferta
						</button>
						<button
							disabled={busy || !input}
							onClick={() =>
								void run(async () => {
									if (!transport.current)
										throw new Error("Crie uma oferta primeiro.");
									await transport.current.acceptAnswer(input);
									setConnected(true);
								})
							}
						>
							Finalizar com resposta
						</button>
					</div>
					<label>
						Código recebido
						<textarea
							aria-label="Código recebido"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							maxLength={24000}
						/>
					</label>
					<label>
						Código para o outro participante
						<textarea
							aria-label="Código para o outro participante"
							value={output}
							readOnly
						/>
					</label>
					<p role="status">
						{connected
							? "Canal aberto; participação validada."
							: "Sem canal confirmado."}
					</p>
					<button
						disabled={busy || !connected}
						onClick={() =>
							void run(async () => {
								if (!transport.current) throw new Error("Canal ausente.");
								await prepare(node);
								await node.forward(transport.current);
								setMessage(
									"Troca concluída. Recibos de intermediários não confirmam entrega à central.",
								);
							})
						}
					>
						Trocar mensagens e recibos
					</button>
					<button
						onClick={() => {
							transport.current?.close();
							setConnected(false);
							setOutput("");
							setInput("");
						}}
					>
						Encerrar conexão
					</button>
				</details>
			)}
			<button
				disabled={busy || !node || !policy.enabled || policy.paused || survival}
				onClick={() =>
					void run(async () => {
						if (node) {
							await prepare(node);
							await gateway(node);
							setMessage(
								"Fila verificada; somente recibos assinados confirmam a central.",
							);
						}
					})
				}
			>
				Enviar cópias à central
			</button>
			{node && policy.enabled && !policy.paused && !survival && (
				<BluetoothPanel node={node} prepare={() => prepare(node)} />
			)}
			<p data-testid="mesh-counts">
				{rows.filter((r) => r.ownIncidentId).length} envelopes próprios ·{" "}
				{rows.filter((r) => !r.ownIncidentId).length} cópias cifradas de
				terceiros · {rows.filter((r) => r.serverReceipt).length} recibos da
				central nesta fila
			</p>
			{metrics && (
				<p>
					Retransmissões confirmadas: {metrics.forwarded} · Duplicatas evitadas:{" "}
					{metrics.duplicates} · Falhas: {metrics.failures} · Reserva de
					internet hoje: {metrics.internetBytes} bytes
				</p>
			)}
			{rows
				.filter((r) => r.ownIncidentId)
				.map((r) => (
					<p key={r.messageId}>
						Meu registro {r.ownIncidentId?.slice(0, 8)}:{" "}
						{r.serverReceipt
							? "recebido pela central"
							: r.nodeReceipts.length
								? "recebido por intermediário; central ainda não confirmada"
								: r.expires <= seconds()
									? "envelope expirado; original continua salvo"
									: "aguardando encontro ou internet"}
					</p>
				))}
			{message && (
				<p className="notice" role="status">
					{message}
				</p>
			)}
		</section>
	);
}
