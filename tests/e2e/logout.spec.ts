import { test, expect } from "@playwright/test";

test("logout ignores an authenticated list response that completes after exit", async ({
	page,
}) => {
	await page.goto("/central.html");
	await page
		.getByLabel("Chave do operador")
		.fill(process.env.E2E_OPERATOR_TOKEN!);
	await page.getByRole("button", { name: "Acessar registros" }).click();
	await expect(
		page.getByRole("button", { name: "Sair", exact: true }),
	).toBeVisible();
	let release!: () => void, started!: () => void;
	const waiting = new Promise<void>((resolve) => {
			release = resolve;
		}),
		seen = new Promise<void>((resolve) => {
			started = resolve;
		});
	await page.route("**/api/v1/incidents?**", async (route) => {
		const response = await route.fetch();
		started();
		await waiting;
		await route.fulfill({ response });
	});
	await page
		.getByRole("button", { name: "Atualizar registros", exact: true })
		.click();
	await seen;
	await page.getByRole("button", { name: "Sair", exact: true }).click();
	await expect(page.getByLabel("Chave do operador")).toBeVisible();
	const response = page.waitForResponse((r) =>
		r.url().includes("/api/v1/incidents?"),
	);
	release();
	await response;
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
	await expect(page.getByLabel("Chave do operador")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Sair", exact: true }),
	).toHaveCount(0);
});
