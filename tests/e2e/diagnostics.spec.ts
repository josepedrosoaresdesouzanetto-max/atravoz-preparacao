import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("safe diagnostic export and explicitly authorized signed upload reach the same central", async ({
	page,
	request,
}) => {
	await page.goto("/");
	const headers = { Authorization: `Bearer ${process.env.E2E_OPERATOR_TOKEN}` };
	const invite = await (
		await request.post("/api/v1/mesh/invitations", { headers })
	).json();
	await page
		.getByText("Preparar este aparelho com um convite da equipe", {
			exact: true,
		})
		.click();
	await page
		.getByLabel("Identificador da autoridade", { exact: true })
		.fill(invite.authority_id);
	await page
		.getByLabel("Convite de participação", { exact: true })
		.fill(invite.invitation);
	await page
		.getByRole("button", { name: "Preparar participação", exact: true })
		.click();
	await expect(
		page.getByText(
			"Aparelho preparado. A participação continua desligada até você ativar.",
			{ exact: true },
		),
	).toBeVisible();
	await page.route("**/api/v1/incidents**", (r) =>
		r.fulfill({ status: 503, json: { detail: "Synthetic failure" } }),
	);
	await page
		.getByText("Adicionar detalhes antes de salvar (opcional)", { exact: true })
		.click();
	const secret = "NOME PRIVADO FICTÍCIO endereço EXATO segredo jamais exportar";
	await page.getByLabel("O que está acontecendo?").fill(secret);
	await page.getByRole("button", { name: "PRECISO DE SOCORRO" }).click();
	await expect(page.getByTestId("local-record")).toContainText("503");
	await page
		.getByText("Diagnóstico técnico e exportação", { exact: true })
		.click();
	const downloading = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "Exportar diagnóstico em JSON", exact: true })
		.click();
	const file = await (await downloading).path();
	const text = await readFile(file!, "utf8");
	expect(text).not.toContain(secret);
	expect(text).not.toContain(invite.invitation);
	const report = JSON.parse(text);
	expect(report.privacy).toBe("allowlisted-technical-fields-only");
	expect(
		report.events.some((e: { code: string }) => e.code === "SYNC_FAILED"),
	).toBe(true);
	await expect(
		page.getByRole("button", {
			name: "Guardar diagnóstico autorizado na fila",
		}),
	).toBeDisabled();
	await page
		.getByLabel(
			"Autorizo enviar estes diagnósticos técnicos à central configurada",
			{ exact: true },
		)
		.check();
	await page
		.getByRole("button", { name: "Guardar diagnóstico autorizado na fila" })
		.click();
	await expect(
		page.getByRole("button", { name: "Enviar diagnósticos autorizados" }),
	).toBeDisabled();
	await page
		.getByLabel("Conferi que estou em Wi-Fi para este envio de diagnóstico", {
			exact: true,
		})
		.check();
	await page
		.getByRole("button", { name: "Enviar diagnósticos autorizados" })
		.click();
	await expect(
		page.getByText("Diagnósticos autorizados recebidos pela central.", {
			exact: true,
		}),
	).toBeVisible();
	const data = await (
		await request.get("/api/v1/diagnostics", { headers })
	).json();
	expect(data.reports.length).toBeGreaterThan(0);
	expect(JSON.stringify(data)).not.toContain(secret);
	await page.unroute("**/api/v1/incidents**");
	await page.goto("/central/");
	await page
		.getByLabel("Chave do operador")
		.fill(process.env.E2E_OPERATOR_TOKEN!);
	await page.getByRole("button", { name: "Acessar registros" }).click();
	await page.getByRole("button", { name: "Consultar diagnósticos" }).click();
	await expect(
		page.getByRole("heading", { name: "Diagnósticos do Sistema" }),
	).toBeVisible();
	await expect(
		page.getByText("SYNC_FAILED:", { exact: false }).first(),
	).toBeVisible();
});
test("Central Mobile caches its interface but never authenticated API responses", async ({
	page,
	context,
}) => {
	await page.goto("/central/");
	await page.getByText("Instalar Central Mobile", { exact: true }).click();
	await expect(
		page.getByText(
			"Interface preparada para reabertura; consultas exigem conexão e autenticação.",
			{ exact: false },
		),
	).toBeVisible();
	const manifest = await (
		await page.request.get("/central/manifest.webmanifest")
	).json();
	expect(manifest.start_url).toBe("/central/");
	expect(manifest.scope).toBe("/central/");
	await context.setOffline(true);
	await page.reload();
	await expect(
		page.getByText(
			"Sem conexão: os dados já exibidos são da última consulta, não uma sincronização atual.",
			{ exact: true },
		),
	).toBeVisible();
	await expect(page.getByLabel("Chave do operador")).toBeVisible();
	const cached = await page.evaluate(async () => {
		const paths: string[] = [];
		for (const name of await caches.keys()) {
			for (const r of await (await caches.open(name)).keys())
				paths.push(new URL(r.url).pathname);
		}
		return paths;
	});
	expect(cached.some((p) => p.startsWith("/api/"))).toBe(false);
});

test("central issues one-use participant invitations only after authentication and removes them on logout", async ({
	page,
}) => {
	await page.goto("/central/");
	await expect(
		page.getByRole("button", { name: "Gerar convite de participante" }),
	).toHaveCount(0);
	await page
		.getByLabel("Chave do operador")
		.fill(process.env.E2E_OPERATOR_TOKEN!);
	await page.getByRole("button", { name: "Acessar registros" }).click();
	await page
		.getByText("Preparar celulares para a Rede Solidária", { exact: true })
		.click();
	await page
		.getByRole("button", { name: "Gerar convite de participante" })
		.click();
	await expect(page.getByLabel("Convite para um aparelho")).toHaveValue(
		/^[A-Za-z0-9_-]{43}$/,
	);
	await expect(page.getByLabel("Identificador da autoridade")).toHaveValue(
		/^[A-Za-z0-9_-]{43}$/,
	);
	await page.getByRole("button", { name: "Sair", exact: true }).click();
	await expect(page.getByLabel("Convite para um aparelho")).toHaveCount(0);
});
