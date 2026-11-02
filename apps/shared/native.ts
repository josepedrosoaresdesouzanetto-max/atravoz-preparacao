import {
	Capacitor,
	registerPlugin,
	type PluginListenerHandle,
} from "@capacitor/core";
export const isAndroid = () => Capacitor.getPlatform() === "android";
export type RadioEvent = {
	type:
		| "device"
		| "connected"
		| "frame"
		| "closed"
		| "error"
		| "listening"
		| "discoveryFinished";
	code?: string;
	data?: string;
	address?: string;
	name?: string;
};
export const Proximity = registerPlugin<{
	capabilities(): Promise<{
		supported: boolean;
		transport: string;
		foregroundOnly: boolean;
		sdk: number;
		model: string;
	}>;
	authorize(): Promise<{ granted: boolean }>;
	discover(): Promise<void>;
	listen(): Promise<void>;
	connect(value: { address: string }): Promise<void>;
	stop(): Promise<void>;
	send(value: { data: string }): Promise<void>;
	addListener(
		name: "radio",
		callback: (event: RadioEvent) => void,
	): Promise<PluginListenerHandle>;
	exportDiagnostic(value: {
		data: string;
		format: "json" | "md";
	}): Promise<void>;
}>("AtravozProximity");
export function validateApiOrigin(value: string) {
	const u = new URL(value);
	if (
		u.protocol !== "https:" ||
		u.username ||
		u.password ||
		u.pathname !== "/" ||
		u.search ||
		u.hash
	)
		throw new Error(
			"Use a origem HTTPS confiável da central, sem caminho, senha ou parâmetros.",
		);
	return u.origin;
}
export function apiOrigin() {
	return isAndroid() ? localStorage.getItem("atravoz-api-origin") || "" : "";
}
export const apiFetch: typeof fetch = (input, init) => {
	if (typeof input === "string" && input.startsWith("/api/") && isAndroid()) {
		const origin = apiOrigin();
		if (!origin)
			return Promise.reject(
				new Error(
					"Configure o endereço HTTPS da central. O registro local permanece salvo.",
				),
			);
		return fetch(validateApiOrigin(origin) + input, init);
	}
	return fetch(input, init);
};
export async function saveText(
	data: string,
	format: "json" | "md",
	name = "ATRAVOZ-diagnostico",
) {
	if (isAndroid()) {
		await Proximity.exportDiagnostic({ data, format });
		return;
	}
	const url = URL.createObjectURL(
		new Blob([data], {
			type:
				format === "json" ? "application/json" : "text/markdown;charset=utf-8",
		}),
	);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${name}.${format}`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
