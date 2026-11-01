import { useEffect, useState } from "react";
type InstallEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: string }>;
};
export function InstallPanel() {
	const [event, setEvent] = useState<InstallEvent | null>(null),
		[message, setMessage] = useState("");
	useEffect(() => {
		const available = (e: Event) => {
			e.preventDefault();
			setEvent(e as InstallEvent);
		};
		const installed = () => {
			setEvent(null);
			setMessage(
				"O navegador informou a instalação. Abra pelo ícone e confira seus registros.",
			);
		};
		window.addEventListener("beforeinstallprompt", available);
		window.addEventListener("appinstalled", installed);
		return () => {
			window.removeEventListener("beforeinstallprompt", available);
			window.removeEventListener("appinstalled", installed);
		};
	}, []);
	return (
		<details className="card">
			<summary>Instalar e preparar para uso offline</summary>
			<p>
				Abra uma vez com conexão e aguarde a confirmação de preparação offline.
				No Android, use “Instalar aplicativo” ou “Adicionar à tela inicial” no
				menu do navegador. No iPhone, abra no Safari e use Compartilhar →
				Adicionar à Tela de Início. A disponibilidade depende do navegador.
			</p>
			{event && (
				<button
					onClick={() =>
						void (async () => {
							try {
								await event.prompt();
								const choice = await event.userChoice;
								setMessage(
									choice.outcome === "accepted"
										? "Solicitação aceita; confirme a instalação no aparelho."
										: "Você pode instalar depois pelo menu do navegador.",
								);
								setEvent(null);
							} catch {
								setMessage(
									"Instalação não concluída; tente pelo menu do navegador.",
								);
							}
						})()
					}
				>
					Instalar aplicativo
				</button>
			)}
			<p>
				Para outros aparelhos, a equipe precisa fornecer um endereço HTTPS
				confiável. O endereço 127.0.0.1 funciona somente neste computador. A
				instalação não habilita Bluetooth nem execução contínua em segundo
				plano.
			</p>
			{message && <p role="status">{message}</p>}
		</details>
	);
}
