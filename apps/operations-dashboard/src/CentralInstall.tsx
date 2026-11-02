import { diagnostics } from "../../../packages/diagnostics/src";
import { useEffect, useState } from "react";
export function CentralInstall() {
	const [offline, setOffline] = useState(!navigator.onLine),
		[ready, setReady] = useState(false);
	useEffect(() => {
		const update = () => setOffline(!navigator.onLine);
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		if (
			location.pathname.startsWith("/central/") &&
			"serviceWorker" in navigator
		)
			void navigator.serviceWorker
				.register("/central/sw.js", { scope: "/central/" })
				.then(() => navigator.serviceWorker.ready)
				.then(() => setReady(true))
				.catch(() => {
					void diagnostics.record("UPDATE_FAILED", "update", "update", {
						recovery: "retry",
					});
				});
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);
	return (
		<>
			<p className={offline ? "notice" : "muted"}>
				{offline
					? "Sem conexão: os dados já exibidos são da última consulta, não uma sincronização atual."
					: "Central consulta a mesma API; ocorrências não são copiadas para uma base independente no celular."}
			</p>
			<details className="card">
				<summary>Instalar Central Mobile</summary>
				<p>
					<a href="/central/">Abrir endereço instalável da central</a>. Em HTTPS
					confiável, use Instalar/Adicionar à tela inicial no navegador Android,
					ou Compartilhar → Adicionar à Tela de Início no Safari.
				</p>
				<p>
					{ready
						? "Interface preparada para reabertura; consultas exigem conexão e autenticação."
						: "Preparação da interface depende do primeiro acesso ao endereço instalável."}{" "}
					Nenhuma instalação física foi comprovada nesta execução. Relatos,
					anexos e respostas da API não entram no cache offline da central.
				</p>
			</details>
		</>
	);
}
