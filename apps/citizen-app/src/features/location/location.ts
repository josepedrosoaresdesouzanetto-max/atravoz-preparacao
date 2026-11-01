import type { Location } from "../../../../../packages/contracts/src";
export async function locate(): Promise<Location> {
	if (!navigator.geolocation)
		throw new Error(
			"GPS indisponível. Informe uma referência ou salve sem localização.",
		);
	return new Promise((resolve, reject) =>
		navigator.geolocation.getCurrentPosition(
			(p) =>
				resolve({
					source: "gps",
					latitude: p.coords.latitude,
					longitude: p.coords.longitude,
					accuracy_m: p.coords.accuracy,
					timestamp: new Date(p.timestamp).toISOString(),
					reference: "",
					confirmed: false,
				}),
			() =>
				reject(
					new Error(
						"Não foi possível obter o GPS. Use uma referência ou salve sem localização.",
					),
				),
			{ timeout: 8000, maximumAge: 0, enableHighAccuracy: false },
		),
	);
}
