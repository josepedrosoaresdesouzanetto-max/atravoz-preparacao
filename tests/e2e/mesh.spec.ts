import {
	test,
	expect,
	type Page,
	type APIRequestContext,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

async function enroll(page: Page, request: APIRequestContext) {
	await page.goto("/");
	await expect(
		page.getByLabel("Participar da Rede Solidária", { exact: true }),
	).not.toBeChecked();
	const response = await request.post("/api/v1/mesh/invitations", {
		headers: { Authorization: `Bearer ${process.env.E2E_OPERATOR_TOKEN}` },
	});
	expect(response.ok()).toBeTruthy();
	const invite = await response.json();
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
	await page
		.getByLabel("Participar da Rede Solidária", { exact: true })
		.check();
}
async function openConnection(page: Page) {
	const summary = page.getByText("Conectar dois participantes", {
		exact: true,
	});
	if (
		!(await page
			.getByRole("button", { name: "Criar oferta", exact: true })
			.isVisible())
	)
		await summary.click();
}
async function connect(a: Page, b: Page) {
	await openConnection(a);
	await openConnection(b);
	await a.getByRole("button", { name: "Criar oferta", exact: true }).click();
	await expect(
		a.getByLabel("Código para o outro participante", { exact: true }),
	).not.toHaveValue("");
	await b
		.getByLabel("Código recebido", { exact: true })
		.fill(
			await a
				.getByLabel("Código para o outro participante", { exact: true })
				.inputValue(),
		);
	await b.getByRole("button", { name: "Aceitar oferta", exact: true }).click();
	await expect(
		b.getByLabel("Código para o outro participante", { exact: true }),
	).not.toHaveValue("");
	await a
		.getByLabel("Código recebido", { exact: true })
		.fill(
			await b
				.getByLabel("Código para o outro participante", { exact: true })
				.inputValue(),
		);
	await a
		.getByRole("button", { name: "Finalizar com resposta", exact: true })
		.click();
	await expect(
		a.getByText("Canal aberto; participação validada.", { exact: true }),
	).toBeVisible({ timeout: 15000 });
	await expect(
		b.getByText("Canal aberto; participação validada.", { exact: true }),
	).toBeVisible();
}
test("Mesh: three browser profiles, real WebRTC A→B→C→API and later receipt C→B→A", async ({
	browser,
	request,
}) => {
	test.setTimeout(120000);
	const contexts = await Promise.all([
		browser.newContext(),
		browser.newContext(),
		browser.newContext(),
	]);
	try {
		const [a, b, c] = await Promise.all(contexts.map((x) => x.newPage()));
		await enroll(a, request);
		await enroll(b, request);
		await enroll(c, request);
		// WAN failure is simulated only for HTTP API; the actual local WebRTC data channels remain live.
		await a.route("**/api/v1/incidents**", (r) =>
			r.fulfill({ status: 503, json: { detail: "Synthetic WAN failure" } }),
		);
		await b.route("**/api/v1/incidents**", (r) =>
			r.fulfill({ status: 503, json: { detail: "Synthetic WAN failure" } }),
		);
		await a
			.getByText("Adicionar detalhes antes de salvar (opcional)", {
				exact: true,
			})
			.click();
		const description =
			"MESH E2E SINTÉTICO: quatro pessoas ilhadas na Rua Exemplo.";
		await a.getByLabel("O que está acontecendo?").fill(description);
		await a.getByRole("button", { name: "PRECISO DE SOCORRO" }).click();
		await expect(a.getByTestId("local-record")).toContainText(description);
		const id = (
			await a.getByTestId("local-record").locator(".id").first().innerText()
		).replace("ID: ", "");
		await connect(a, b);
		await a
			.getByRole("button", { name: "Trocar mensagens e recibos", exact: true })
			.click();
		await expect(a.locator(".mesh-panel")).toContainText(
			"recebido por intermediário; central ainda não confirmada",
		);
		await expect(a.getByTestId("local-record")).not.toContainText(
			"Recebimento confirmado pelo protótipo",
		);
		await b.reload();
		await expect(b.getByTestId("mesh-counts")).toContainText(
			"1 cópias cifradas de terceiros",
		);
		await expect(b.locator("body")).not.toContainText(description);
		await connect(b, c);
		await b
			.getByRole("button", { name: "Trocar mensagens e recibos", exact: true })
			.click();
		await expect(b.locator(".mesh-panel")).toContainText("Troca concluída.");
		await c.reload();
		await expect(c.getByTestId("mesh-counts")).toContainText(
			"1 cópias cifradas de terceiros",
		);
		// Default unknown network must not upload relay traffic.
		await c
			.getByRole("button", { name: "Enviar cópias à central", exact: true })
			.click();
		await expect(c.locator(".mesh-panel")).toContainText(
			"Internet não autorizada",
		);
		await c
			.getByText("Limites de bateria, espaço e internet", { exact: true })
			.click();
		await c
			.getByLabel("Conferi nas configurações: estou em Wi-Fi nesta sessão", {
				exact: true,
			})
			.check();
		await c
			.getByRole("button", { name: "Enviar cópias à central", exact: true })
			.click();
		await expect(c.getByTestId("mesh-counts")).toContainText(
			"1 recibos da central",
		);
		await expect(a.getByTestId("local-record")).not.toContainText(
			"Recebimento confirmado pelo protótipo",
		);
		const headers = {
			Authorization: `Bearer ${process.env.E2E_OPERATOR_TOKEN}`,
		};
		const detail = await (
			await request.get(`/api/v1/incidents/${id}`, { headers })
		).json();
		expect(detail.description).toBe(description);
		expect(detail.mesh_deliveries).toHaveLength(1);
		expect(detail.mesh_deliveries[0].hops).toBe(2);
		await connect(c, b);
		await c
			.getByRole("button", { name: "Trocar mensagens e recibos", exact: true })
			.click();
		await expect(c.locator(".mesh-panel")).toContainText("Troca concluída.");
		await connect(b, a);
		await b
			.getByRole("button", { name: "Trocar mensagens e recibos", exact: true })
			.click();
		await expect(a.getByTestId("local-record")).toContainText(
			"Recebimento confirmado pelo protótipo",
		);
		await a.reload();
		await expect(a.getByTestId("local-record")).toContainText(
			"Recebimento confirmado pelo protótipo",
		);
		const listing = await (
			await request.get("/api/v1/incidents", { headers })
		).json();
		expect(
			listing.items.filter(
				(x: { incident_id: string }) => x.incident_id === id,
			),
		).toHaveLength(1);
		await mkdir("docs/evidence", { recursive: true });
		await a.screenshot({
			path: "docs/evidence/mesh-origin.png",
			fullPage: true,
		});
		await writeFile(
			"docs/evidence/mesh-webrtc.json",
			JSON.stringify(
				{
					tested_at: new Date().toISOString(),
					transport: "RTCPeerConnection / RTCDataChannel",
					environment:
						"Three isolated Edge browser contexts on one Windows computer",
					physical_devices: 0,
					wan_loss:
						"HTTP 503 interception for A and B; not loss of physical radio",
					route: "A → B (reload) → C (reload) → API; receipt C → B → A",
					incident_id: id,
					verified_hops: 2,
					independent_incidents: 1,
					origin_notified_only_after_receipt_return: true,
					relay_plaintext_rendered: false,
				},
				null,
				2,
			),
		);
	} finally {
		await Promise.all(contexts.map((x) => x.close()));
	}
});
