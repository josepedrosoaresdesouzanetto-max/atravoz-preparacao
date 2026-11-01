import { z } from "zod";
export const MAX_ENVELOPE_BYTES = 65536;
export const MAX_SEALED_BYTES = 16384;
export const SKEW_SECONDS = 300;
export const textEncoder = new TextEncoder();
export const jsonBytes = (value: unknown) =>
	textEncoder.encode(JSON.stringify(value));
export const PublicJwk = z
	.object({
		kty: z.literal("EC"),
		crv: z.literal("P-256"),
		x: z.string().max(100),
		y: z.string().max(100),
	})
	.strict();
export const CredentialClaims = z
	.object({
		aud: z.literal("mesh-member-v1"),
		sub: z.string().length(43),
		jwk: PublicJwk,
		iat: z.number().int(),
		nbf: z.number().int(),
		exp: z.number().int(),
		role: z.literal("participant"),
	})
	.strict();
export const OriginClaims = z
	.object({
		kind: z.literal("mesh-origin"),
		version: z.literal(1),
		message_id: z.uuid(),
		created: z.number().int(),
		expires: z.number().int(),
		max_hops: z.number().int().min(1).max(4),
		payload_size: z.number().int().min(1).max(MAX_SEALED_BYTES),
		cipher_hash: z.string().length(43),
		priority: z.literal("normal"),
	})
	.strict();
export const HopClaims = z
	.object({
		kind: z.literal("mesh-hop"),
		message_id: z.uuid(),
		origin_hash: z.string().length(43),
		previous: z.string().length(43),
		sender: z.string().length(43),
		receiver: z.string().length(43),
		index: z.number().int().min(1).max(4),
		transmission_id: z.uuid(),
		at: z.number().int(),
	})
	.strict();
export const EnvelopeSchema = z
	.object({
		version: z.literal(1),
		origin_credential: z.string().max(3000),
		sealed: z.string().max(MAX_SEALED_BYTES),
		origin_proof: z.string().max(3000),
		hops: z
			.array(
				z
					.object({
						credential: z.string().max(3000),
						proof: z.string().max(3000),
					})
					.strict(),
			)
			.max(4),
	})
	.strict();
export const ReceiptClaims = z
	.object({
		kind: z.literal("mesh-server-receipt"),
		message_id: z.uuid(),
		origin_hash: z.string().length(43),
		receipt_id: z.uuid(),
		server_received_at: z.string().datetime({ offset: true }),
		status: z.literal("RECEBIDO_PELO_SERVIDOR"),
	})
	.strict();
export const NodeReceiptClaims = z
	.object({
		kind: z.literal("mesh-node-receipt"),
		message_id: z.uuid(),
		origin_hash: z.string().length(43),
		transmission_id: z.uuid(),
		receiver: z.string().length(43),
		stored_at: z.number().int(),
		status: z.literal("RECEBIDO_POR_INTERMEDIARIO"),
	})
	.strict();
export type Envelope = z.infer<typeof EnvelopeSchema>;
export type ServerDelivery = z.infer<typeof ReceiptClaims>;
export type Member = z.infer<typeof CredentialClaims>;
export type Trust = {
	authority_id: string;
	signing_jwk: JsonWebKey;
	encryption_jwk: JsonWebKey;
	revoked: string[];
};
export type Identity = {
	privateKey: CryptoKey;
	publicJwk: z.infer<typeof PublicJwk>;
	credential: string;
	subject: string;
};
export type VerifiedEnvelope = {
	envelope: Envelope;
	origin: z.infer<typeof OriginClaims>;
	originHash: string;
	holder: string;
	visited: string[];
};
export const seconds = () => Math.floor(Date.now() / 1000);
