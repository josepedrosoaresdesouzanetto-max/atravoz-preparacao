import { z } from "zod";
export const PolicySchema = z
	.object({
		enabled: z.boolean(),
		paused: z.boolean(),
		allowMobile: z.boolean(),
		relayBytes: z
			.number()
			.int()
			.min(65536)
			.max(8 * 1024 * 1024),
		maxMessages: z.number().int().min(1).max(128),
		dailyInternetBytes: z
			.number()
			.int()
			.min(65536)
			.max(10 * 1024 * 1024),
		minBatteryPercent: z.number().min(5).max(80),
		searchIntervalMs: z.number().int().min(30000).max(600000),
		maxCopies: z.number().int().min(1).max(3),
		maxAttempts: z.number().int().min(1).max(10),
		perEncounter: z.number().int().min(1).max(8),
	})
	.strict();
export type ResourcePolicy = z.infer<typeof PolicySchema>;
export const defaultPolicy: ResourcePolicy = {
	enabled: false,
	paused: false,
	allowMobile: false,
	relayBytes: 2 * 1024 * 1024,
	maxMessages: 64,
	dailyInternetBytes: 1024 * 1024,
	minBatteryPercent: 20,
	searchIntervalMs: 60000,
	maxCopies: 2,
	maxAttempts: 6,
	perEncounter: 4,
};
export type ResourceSignal = {
	network: "wifi" | "cellular" | "unknown" | "offline";
	batteryPercent: number | null;
};
export function participation(policy: ResourcePolicy, signal: ResourceSignal) {
	if (!policy.enabled || policy.paused)
		throw new Error("Rede Solidária desativada ou pausada.");
	if (
		signal.batteryPercent !== null &&
		signal.batteryPercent < policy.minBatteryPercent
	)
		throw new Error("Retransmissão pausada por bateria baixa.");
}
export function internetAllowed(
	policy: ResourcePolicy,
	signal: ResourceSignal,
) {
	participation(policy, signal);
	if (
		signal.network === "offline" ||
		(signal.network !== "wifi" && !policy.allowMobile)
	)
		throw new Error(
			"Internet não autorizada: confirme Wi-Fi ou permita dados móveis/rede desconhecida.",
		);
}
export class ConcurrencyGate {
	private active = false;
	constructor(readonly name: string = crypto.randomUUID()) {}
	async run<T>(work: () => Promise<T>): Promise<T> {
		if (this.active)
			throw new Error("Uma conexão/transferência já está ativa.");
		this.active = true;
		try {
			if (typeof navigator !== "undefined" && navigator.locks)
				return await navigator.locks.request(
					`mesh-transfer-${this.name}`,
					{ ifAvailable: true },
					async (lock) => {
						if (!lock) throw new Error("Outra aba está transferindo.");
						return work();
					},
				);
			return await work();
		} finally {
			this.active = false;
		}
	}
}
