import { z } from "zod";
import { IncidentSchema } from "../../../packages/contracts/src";
const Analysis = z.object({
	analysis_id: z.string(),
	model_name: z.string(),
	processing_status: z.enum(["model", "rules", "fallback"]),
	suggested_category: z.string(),
	extracted_information: z.object({
		people_mentioned: z.number().nullable(),
		people_evidence: z.string().nullable(),
		conditions: z.array(z.string()),
	}),
	missing_information: z.array(z.string()),
	possible_duplicates: z.array(
		z.object({
			incident_id: z.string(),
			score: z.number(),
			reasons: z.array(z.string()),
		}),
	),
	limitations: z.array(z.string()),
	human_review_required: z.literal(true),
	information_confirmed: z.literal(false),
	confidence: z.string(),
	processed_at: z.string(),
	raw_output: z.string().nullable(),
	error_code: z.string().nullable(),
});
export const DetailSchema = IncidentSchema.safeExtend({
	status: z.string(),
	server_received_at: z.string(),
	has_audio: z.boolean(),
	has_photo: z.boolean(),
	received_attachments: z.array(
		z.object({
			id: z.string(),
			mime: z.string(),
			sha256: z.string(),
			received_at: z.string(),
		}),
	),
	history: z.array(
		z.object({
			status: z.string(),
			at: z.string(),
			actor: z.string(),
			note: z.string(),
		}),
	),
	analyses: z.array(Analysis),
	mesh_deliveries: z
		.array(
			z.object({
				message_id: z.string().uuid(),
				hops: z.number().int(),
				received_at: z.string(),
			}),
		)
		.default([]),
});
export const PageSchema = z.object({
	items: z.array(DetailSchema),
	total: z.number(),
	limit: z.number(),
	offset: z.number(),
});
export type Detail = z.infer<typeof DetailSchema>;
export async function request(
	token: string,
	path: string,
	init: RequestInit = {},
) {
	const result = await fetch("/api/v1" + path, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
		},
		signal: AbortSignal.timeout(30000),
		cache: "no-store",
	});
	if (!result.ok)
		throw new Error(
			result.status === 401
				? "Acesso negado. Verifique a chave do operador."
				: result.status === 503
					? "Serviço indisponível ou chave administrativa não configurada."
					: `Operação não concluída (${result.status}). Atualize os dados e tente novamente.`,
		);
	return result;
}
