import { useState } from "react";
import { z } from "zod";
import { request } from "./api";
const invitationSchema = z.object({
	invitation: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
	authority_id: z.string().length(43),
	expires: z.number().int(),
});
export function MeshEnrollment({ token }: { token: string }) {
	const [invite, setInvite] = useState<z.infer<typeof invitationSchema> | null>(
		null,
	);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const create = async () => {
		setBusy(true);
		setInvite(null);
		setError("");
		try {
			setInvite(
				invitationSchema.parse(
					await (
						await request(token, "/mesh/invitations", { method: "POST" })
					).json(),
				),
			);
		} catch {
			setError(
				"Convite não gerado. Confira a autenticação e a configuração da Rede Solidária.",
			);
		} finally {
			setBusy(false);
		}
	};
	return (
		<details className="card">
			<summary>Preparar celulares para a Rede Solidária</summary>
			<p>
				Gere um convite por aparelho. No cidadão, configure a mesma central
				HTTPS, abra a preparação da Rede Solidária e informe o convite e o
				identificador abaixo. Confira o identificador por um canal confiável.
			</p>
			<button disabled={busy} onClick={() => void create()}>
				Gerar convite de participante
			</button>
			{error && <p role="alert">{error}</p>}
			{invite && (
				<div>
					<label>
						Convite para um aparelho
						<input readOnly value={invite.invitation} />
					</label>
					<label>
						Identificador da autoridade
						<input readOnly value={invite.authority_id} />
					</label>
					<p>
						Uso único; vence em{" "}
						{new Date(invite.expires * 1000).toLocaleTimeString("pt-BR")}. Não
						inclua este convite em diagnósticos. A chave do operador permanece
						com o responsável pela central.
					</p>
					<button onClick={() => setInvite(null)}>Ocultar convite</button>
				</div>
			)}
		</details>
	);
}
