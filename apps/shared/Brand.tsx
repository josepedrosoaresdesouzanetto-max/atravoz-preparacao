import { apiFetch } from "./native";
import { useEffect, useState } from "react";
export function Brand() {
	const [name, setName] = useState(import.meta.env.VITE_APP_NAME || "ATRAVOZ");
	useEffect(() => {
		apiFetch("/api/v1/config", { signal: AbortSignal.timeout(3000) })
			.then((r) => (r.ok ? r.json() : null))
			.then((v) => {
				if (v?.app_name) setName(v.app_name);
			})
			.catch(() => {});
	}, []);
	return (
		<span className="brand">
			<span className="brandmark" aria-hidden="true">
				↗
			</span>
			{name}
		</span>
	);
}
