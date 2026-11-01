import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

test("B: offline, reabre, sincroniza, preserva ID, banco e central", async ({
	page,
	context,
	request,
}) => {
	await page.goto("/");
	await expect(
		page.getByText("Aplicativo preparado para reabrir sem conexão.", {
			exact: false,
		}),
	).toBeVisible();
	await context.setOffline(true);
	await page
		.getByText("Adicionar detalhes antes de salvar (opcional)", { exact: true })
		.click();
	const text =
		"TESTE E2E SINTÉTICO: três pessoas ilhadas no telhado. Água subindo.";
	await page.getByLabel("O que está acontecendo?").fill(text);
	await page.getByRole("button", { name: "PRECISO DE SOCORRO" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"Salvo neste aparelho",
	);
	const id = (
		await page.getByTestId("local-record").locator(".id").first().innerText()
	).replace("ID: ", "");
	await page.close();
	const reopened = await context.newPage();
	await reopened.goto("/");
	await expect(reopened.getByTestId("local-record")).toContainText(text);
	await expect(reopened.getByTestId("local-record")).toContainText(id);
	await context.setOffline(false);
	await reopened.getByRole("button", { name: "Tentar enviar agora" }).click();
	await expect(reopened.getByTestId("local-record")).toContainText(
		"Recebimento confirmado pelo protótipo",
	);
	await reopened.getByRole("button", { name: "Tentar enviar agora" }).click();
	const headers = { Authorization: `Bearer ${process.env.E2E_OPERATOR_TOKEN}` };
	const data = await (
		await request.get("/api/v1/incidents", { headers })
	).json();
	expect(
		data.items.filter((i: { incident_id: string }) => i.incident_id === id),
	).toHaveLength(1);
	await mkdir("docs/evidence", { recursive: true });
	await reopened.screenshot({
		path: "docs/evidence/citizen-mobile.png",
		fullPage: true,
	});
	const dashboard = await context.newPage();
	await dashboard.setViewportSize({ width: 1440, height: 1000 });
	await dashboard.goto("/central.html");
	await dashboard
		.getByLabel("Chave do operador")
		.fill(process.env.E2E_OPERATOR_TOKEN!);
	await dashboard.getByRole("button", { name: "Acessar registros" }).click();
	await dashboard.getByRole("button").filter({ hasText: text }).click();
	await expect(
		dashboard.getByText("Recebimento técnico", { exact: true }),
	).toBeVisible();
	await dashboard.getByRole("button", { name: "Analisar relato" }).click();
	await expect(
		dashboard.getByText("Regras determinísticas · sem modelo generativo", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		dashboard.getByText("Pessoas mencionadas: 3", { exact: false }),
	).toBeVisible();
	await dashboard.screenshot({
		path: "docs/evidence/central-desktop.png",
		fullPage: true,
	});
	await dashboard
		.getByText("Registrar revisão ou correção", { exact: true })
		.click();
	await dashboard
		.getByLabel("Justificativa ou texto da correção")
		.fill("Revisão de teste automatizado, sem validação humana real.");
	await dashboard
		.getByRole("button", { name: "Em verificação", exact: true })
		.click();
	await expect(
		dashboard.getByText(
			"Revisão de teste automatizado, sem validação humana real.",
			{ exact: true },
		),
	).toBeVisible();
	await dashboard.getByRole("button", { name: "Sair", exact: true }).click();
	await expect(dashboard.getByLabel("Chave do operador")).toBeVisible();
});

test("falha HTTP não vira entrega; nenhum GPS necessário", async ({ page }) => {
	await page.route("**/api/v1/incidents", (route) =>
		route.fulfill({ status: 503, body: "{}" }),
	);
	await page.goto("/");
	await page.getByRole("button", { name: "INFORMAR UMA OCORRÊNCIA" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"aguardando conexão",
	);
	await expect(page.getByTestId("local-record")).toContainText("503");
	await expect(page.getByTestId("local-record")).not.toContainText(
		"Recebimento confirmado",
	);
	await page.reload();
	await expect(page.getByTestId("local-record")).toHaveCount(1);
});

test("central não expõe dados sem autenticação e conteúdo HTML é texto", async ({
	page,
	request,
}) => {
	expect((await request.get("/api/v1/incidents")).status()).toBe(401);
	await page.goto("/");
	await page
		.getByText("Adicionar detalhes antes de salvar (opcional)", { exact: true })
		.click();
	await page
		.getByLabel("O que está acontecendo?")
		.fill("<img src=x onerror=alert(1)> TESTE SINTÉTICO");
	await page.getByRole("button", { name: "INFORMAR UMA OCORRÊNCIA" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"<img src=x onerror=alert(1)>",
	);
	await expect(page.getByTestId("local-record").locator("img")).toHaveCount(0);
	await expect(page.getByTestId("local-record")).toContainText(
		"Recebimento confirmado",
	);
});

test("foto sintética permanece offline e só confirma após upload", async ({
	page,
	context,
	request,
}) => {
	await page.goto("/");
	await expect(
		page.getByText("Aplicativo preparado para reabrir sem conexão.", {
			exact: false,
		}),
	).toBeVisible();
	await context.setOffline(true);
	await page
		.getByText("Adicionar detalhes antes de salvar (opcional)", { exact: true })
		.click();
	await page
		.getByLabel("Fotografia opcional")
		.setInputFiles(resolve("fixtures/synthetic/photo.png"));
	await expect(
		page.getByText("Foto pronto para salvar", { exact: false }),
	).toBeVisible();
	await page.getByRole("button", { name: "INFORMAR UMA OCORRÊNCIA" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"Foto: salvo no aparelho · envio pendente",
	);
	await page.reload();
	await expect(page.getByTestId("local-record")).toContainText(
		"Foto: salvo no aparelho · envio pendente",
	);
	await page.route("**/api/v1/incidents/*/attachments", (r) =>
		r.fulfill({ status: 503, body: "{}" }),
	);
	await context.setOffline(false);
	await page.getByRole("button", { name: "Tentar enviar agora" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"Recebimento confirmado",
	);
	await expect(page.getByTestId("local-record")).toContainText(
		"Foto: salvo no aparelho · envio pendente",
	);
	await page.unroute("**/api/v1/incidents/*/attachments");
	await page.getByRole("button", { name: "Tentar enviar agora" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"Foto: recebido pelo servidor",
	);
	const id = (
		await page.getByTestId("local-record").locator(".id").first().innerText()
	).replace("ID: ", "");
	const data = await (
		await request.get(`/api/v1/incidents/${id}`, {
			headers: { Authorization: `Bearer ${process.env.E2E_OPERATOR_TOKEN}` },
		})
	).json();
	expect(data.received_attachments).toHaveLength(1);
});

test("MediaRecorder grava fonte artificial, persiste e envia áudio", async ({
	page,
}) => {
	await page.goto("/");
	await page
		.getByText("Adicionar detalhes antes de salvar (opcional)", { exact: true })
		.click();
	await page
		.getByRole("button", { name: "Gravar áudio · até 30 segundos" })
		.click();
	await expect(
		page.getByRole("button", { name: "Parar gravação" }),
	).toBeVisible();
	// A short recording from Chromium's artificial audio source, not a physical microphone.
	await page.waitForTimeout(700);
	await page.getByRole("button", { name: "Parar gravação" }).click();
	await expect(
		page.getByText("Áudio pronto para salvar", { exact: false }),
	).toBeVisible();
	await page.getByRole("button", { name: "PRECISO DE SOCORRO" }).click();
	await expect(page.getByTestId("local-record")).toContainText(
		"Áudio: recebido pelo servidor",
	);
});
