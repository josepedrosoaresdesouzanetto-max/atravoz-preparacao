import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import {
	Diagnostics,
	ReportSchema,
	markdownReport,
} from "../../packages/diagnostics/src";
const stores: Diagnostics[] = [];
const create = (now = () => Date.now()) => {
	const d = new Diagnostics(crypto.randomUUID(), now);
	stores.push(d);
	return d;
};
afterEach(async () => {
	await Promise.all(stores.splice(0).map((s) => s.close()));
});
it("diagnostics aggregate repeated events and exclude arbitrary sensitive fields", async () => {
	const d = create();
	for (let i = 0; i < 20; i++)
		await d.record("SYNC_FAILED", "sync", "send", { recovery: "queued" });
	const r = await d.report();
	expect(r.events).toHaveLength(1);
	expect(r.events[0].count).toBe(20);
	expect(ReportSchema.safeParse({ ...r, victim: "SECRET" }).success).toBe(
		false,
	);
	expect(
		ReportSchema.safeParse({
			...r,
			events: [{ ...r.events[0], message: "password SECRET" }],
		}).success,
	).toBe(false);
	expect(markdownReport(r)).not.toContain("SECRET");
	expect(markdownReport(r)).toContain("## 12. Limitações");
});
it("diagnostics enforce quota and expiration without touching occurrences", async () => {
	let time = Date.now();
	const d = create(() => time);
	for (let i = 0; i < 330; i++) {
		await d.record("SYNC_FAILED", "sync", "send");
		time += 31000;
	}
	expect((await d.events()).length).toBeLessThanOrEqual(300);
	await d.setRetention(1);
	time += 2 * 86400000;
	expect(await d.events()).toHaveLength(0);
});
it("diagnostic upload needs separate consent and wifi; failure preserves bounded queue", async () => {
	const d = create();
	await d.record("APP_START", "app", "initialize", { result: "success" });
	for (let i = 0; i < 3; i++) await d.enqueue(await d.report());
	await expect(d.enqueue(await d.report())).rejects.toThrow("três");
	await expect(d.sendQueued(async () => {}, false, true)).rejects.toThrow(
		"Confirme",
	);
	await expect(d.sendQueued(async () => {}, true, false)).rejects.toThrow(
		"Confirme",
	);
	await expect(
		d.sendQueued(
			async () => {
				throw new Error("offline");
			},
			true,
			true,
		),
	).rejects.toThrow();
	expect(await d.queued()).toBe(3);
});
it("diagnostic queue persists and confirmed sends are removed", async () => {
	const name = crypto.randomUUID(),
		d = new Diagnostics(name);
	stores.push(d);
	await d.record("API_FAILED", "api", "receive");
	await d.enqueue(await d.report());
	await d.close();
	const reopened = new Diagnostics(name);
	stores.push(reopened);
	expect(await reopened.queued()).toBe(1);
	let sent = 0;
	await reopened.sendQueued(
		async (r) => {
			ReportSchema.parse(r);
			sent++;
		},
		true,
		true,
	);
	expect(sent).toBe(1);
	expect(await reopened.queued()).toBe(0);
});
