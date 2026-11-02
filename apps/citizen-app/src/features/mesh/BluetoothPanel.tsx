import { diagnostics } from "../../../../../packages/diagnostics/src";
import { useEffect, useRef, useState } from "react";
import { Proximity, isAndroid } from "../../../../shared/native";
import { AuthenticatedRadio } from "../../../../../packages/mesh-core/src/proximity";
import type { MeshNode } from "../../../../../packages/mesh-core/src/node";
export default function BluetoothPanel({
	node,
	prepare,
}: {
	node: MeshNode;
	prepare: () => Promise<void>;
}) {
	const [devices, setDevices] = useState<{ address: string; name: string }[]>(
			[],
		),
		[message, setMessage] = useState(""),
		[connected, setConnected] = useState(false),
		[busy, setBusy] = useState(false);
	const transport = useRef<AuthenticatedRadio | null>(null);
	const input = useRef<((data: string) => void) | null>(null);
	useEffect(() => {
		if (!isAndroid()) return;
		const listener = Proximity.addListener("radio", (event) => {
			if (event.type === "device" && event.address)
				setDevices((rows) =>
					rows.some((x) => x.address === event.address)
						? rows
						: rows.length < 30
							? [
									...rows,
									{
										address: event.address!,
										name: event.name || "Android próximo",
									},
								]
							: rows,
				);
			if (event.type === "frame" && event.data) input.current?.(event.data);
			if (event.type === "connected") {
				const t = new AuthenticatedRadio(node, {
					send: (data) => Proximity.send({ data }),
					close: () => {
						void Proximity.stop();
					},
					onData: (fn) => {
						input.current = fn;
						return () => {
							input.current = null;
						};
					},
				});
				transport.current = t;
				void t
					.begin()
					.then(() => t.ready())
					.then(() => {
						setConnected(true);
						setMessage(
							"Participante autenticado. Pronto para trocar envelopes cifrados.",
						);
					})
					.catch(() => {
						setConnected(false);
						void diagnostics.record("MESH_AUTH_FAILED", "mesh", "authenticate");
						setMessage(
							"Autenticação Bluetooth falhou; nenhum recebimento confirmado.",
						);
					});
			}
			if (event.type === "closed" || event.type === "error") {
				transport.current?.close();
				transport.current = null;
				setConnected(false);
				setMessage(
					event.type === "error"
						? "Falha no rádio. Confira permissões, Bluetooth e pareamento."
						: "Conexão encerrada. Cópias locais preservadas.",
				);
			}
			if (event.type === "listening")
				setMessage("Aguardando conexão por até dois minutos.");
		});
		return () => {
			void listener.then((x) => x.remove());
			transport.current?.close();
			void Proximity.stop();
		};
	}, [node]);
	if (!isAndroid()) return null;
	const run = async (action: () => Promise<void>) => {
		setBusy(true);
		try {
			await action();
		} catch (e) {
			void diagnostics.record("RADIO_DISCOVERY_FAILED", "mesh", "discover");
			setMessage(e instanceof Error ? e.message : "Operação não concluída.");
		} finally {
			setBusy(false);
		}
	};
	const permission = async () => {
		const result = await Proximity.authorize();
		if (!result.granted)
			throw new Error(
				"Permissão negada; registro offline continua disponível.",
			);
	};
	return (
		<details>
			<summary>Bluetooth entre Androids · teste experimental</summary>
			<p>
				Mantenha os dois aplicativos abertos. O receptor escolhe “Receber
				conexão”; o emissor procura o aparelho e confirma o pareamento do
				Android. Só participantes com credencial válida podem trocar envelopes.
				Funcionamento físico ainda requer validação nos aparelhos.
			</p>
			<div className="toolbar">
				<button
					disabled={busy}
					onClick={() =>
						void run(async () => {
							await permission();
							await prepare();
							await Proximity.listen();
						})
					}
				>
					Receber conexão Bluetooth
				</button>
				<button
					disabled={busy || connected}
					onClick={() =>
						void run(async () => {
							await permission();
							setDevices([]);
							await Proximity.discover();
							setMessage("Busca por até 15 segundos.");
						})
					}
				>
					Procurar Androids
				</button>
			</div>
			{devices.map((d) => (
				<button
					key={d.address}
					disabled={busy || connected}
					onClick={() =>
						void run(async () => {
							await prepare();
							await Proximity.connect({ address: d.address });
						})
					}
				>
					Conectar: {d.name}
				</button>
			))}
			<button
				disabled={busy || !connected}
				onClick={() =>
					void run(async () => {
						await prepare();
						if (!transport.current)
							throw new Error("Conexão encerrada; origem preservada.");
						const before = await node.store.metrics();
						await node.forward(transport.current);
						const after = await node.store.metrics();
						setMessage(
							`${after.forwarded - before.forwarded} envelopes confirmados pelo intermediário nesta troca. Confira os estados de cada pedido; isto não confirma atendimento.`,
						);
					})
				}
			>
				Trocar por Bluetooth
			</button>
			<button
				onClick={() => {
					transport.current?.close();
					void Proximity.stop();
					setConnected(false);
				}}
			>
				Encerrar Bluetooth
			</button>
			<p role="status">{message}</p>
		</details>
	);
}
