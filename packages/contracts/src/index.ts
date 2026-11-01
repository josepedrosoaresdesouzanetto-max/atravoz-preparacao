import { z } from "zod";
const date = z.iso.datetime({ offset: true });
export const LocationSchema = z
	.strictObject({
		source: z.enum(["gps", "last_known", "manual"]),
		latitude: z.number().min(-90).max(90).nullable().default(null),
		longitude: z.number().min(-180).max(180).nullable().default(null),
		reference: z.string().max(240).default(""),
		accuracy_m: z.number().min(0).max(100000).nullable().default(null),
		timestamp: date,
		confirmed: z.boolean().default(false),
	})
	.superRefine((v, c) => {
		if (
			(v.latitude === null) !== (v.longitude === null) ||
			(v.source !== "manual" && v.latitude === null) ||
			(v.source === "manual" && !v.reference.trim())
		)
			c.addIssue({ code: "custom", message: "Localização incoerente" });
	});
export const AttachmentSchema = z
	.strictObject({
		attachment_id: z.uuid(),
		kind: z.enum(["audio", "photo"]),
		mime_type: z.enum([
			"image/jpeg",
			"image/png",
			"image/webp",
			"audio/webm",
			"audio/ogg",
			"audio/mp4",
			"audio/wav",
		]),
		byte_size: z
			.number()
			.int()
			.min(1)
			.max(4 * 1024 * 1024),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.refine((v) => (v.kind === "photo") === v.mime_type.startsWith("image/"));
export const IncidentSchema = z
	.strictObject({
		schema_version: z.literal(1),
		incident_id: z.uuid(),
		created_at: date,
		updated_at: date,
		record_type: z.enum(["help", "witness"]),
		description: z.string().max(4000),
		synthetic: z.literal(true),
		location: LocationSchema.nullable().default(null),
		origin_device_id: z.uuid().nullable().default(null),
		attachments: z.array(AttachmentSchema).max(2).default([]),
	})
	.superRefine((v, c) => {
		if (Date.parse(v.updated_at) < Date.parse(v.created_at))
			c.addIssue({ code: "custom", message: "Datas incoerentes" });
		if (
			new Set(v.attachments.map((a) => a.attachment_id)).size !==
				v.attachments.length ||
			new Set(v.attachments.map((a) => a.kind)).size !== v.attachments.length
		)
			c.addIssue({ code: "custom", message: "Anexos repetidos" });
	});
export const ReceiptSchema = z.object({
	receipt_id: z.uuid(),
	incident_id: z.uuid(),
	status: z.literal("RECEBIDO_SERVIDOR"),
	server_received_at: date,
	code: z.literal("PERSISTED"),
	message: z.string(),
	attachment_ids_received: z.array(z.uuid()),
});
export type Incident = z.infer<typeof IncidentSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type ServerReceipt = z.infer<typeof ReceiptSchema>;
export type LocalStatus =
	| "SALVO_LOCALMENTE"
	| "AGUARDANDO_CONEXAO"
	| "TRANSFERIDO_PARA_DISPOSITIVO"
	| "RECEBIDO_SERVIDOR";
export const statusLabels: Record<string, string> = {
	RASCUNHO: "Rascunho",
	SALVO_LOCALMENTE: "Salvo neste aparelho",
	AGUARDANDO_CONEXAO: "Salvo · aguardando conexão",
	TRANSFERIDO_PARA_DISPOSITIVO: "Armazenado em outro aparelho",
	RECEBIDO_SERVIDOR: "Recebido pelo protótipo",
	EM_VERIFICACAO: "Em verificação",
	VERIFICADO: "Verificado por operador",
	ATENDIMENTO_CONFIRMADO: "Atendimento confirmado",
	CORRIGIDO: "Correção registrada",
	INVALIDADO: "Invalidado com histórico",
};
