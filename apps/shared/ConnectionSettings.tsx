import { useState } from "react";
import { apiFetch, apiOrigin, isAndroid, validateApiOrigin } from "./native";
export function ConnectionSettings() {
	const [value, setValue] = useState(apiOrigin),
		[message, setMessage] = useState("");
	if (!isAndroid()) return null;
	return (
		<details className="card">
			<summary>Conectar à central</summary>
			<p>
				Informe o endereço HTTPS fornecido pela equipe. A central escolhida
				receberá os registros quando você sincronizar. A troca de central não
				transfere dados já recebidos por outro servidor.
			</p>
			<label>
				Endereço HTTPS da central
				<input
					type="url"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="https://central.exemplo"
				/>
			</label>
			<button
				onClick={() =>
					void (async () => {
						try {
							const origin = validateApiOrigin(value.trim());
							localStorage.setItem("atravoz-api-origin", origin);
							const response = await apiFetch("/api/v1/ready", {
								signal: AbortSignal.timeout(10000),
							});
							if (!response.ok)
								throw new Error(
									"Central indisponível. Endereço salvo; registros locais preservados.",
								);
							setMessage("Conexão com a API verificada.");
						} catch (e) {
							setMessage(
								e instanceof Error ? e.message : "Conexão não concluída.",
							);
						}
					})()
				}
			>
				Salvar endereço e verificar
			</button>
			<p role="status">{message}</p>
			<p>
				Use certificado confiável no Android. Nenhum certificado inválido é
				ignorado automaticamente.
			</p>
		</details>
	);
}
