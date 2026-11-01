import {
	CompactEncrypt,
	CompactSign,
	compactVerify,
	exportJWK,
	generateKeyPair,
	importJWK,
	calculateJwkThumbprint,
	base64url,
	decodeProtectedHeader,
	type JWK,
} from "jose";
import { IncidentSchema, type Incident } from "../../contracts/src";
import {
	CredentialClaims,
	EnvelopeSchema,
	HopClaims,
	OriginClaims,
	PublicJwk,
	ReceiptClaims,
	MAX_ENVELOPE_BYTES,
	MAX_SEALED_BYTES,
	SKEW_SECONDS,
	jsonBytes,
	seconds,
	type Envelope,
	type Identity,
	type Member,
	type Trust,
	type VerifiedEnvelope,
} from "./protocol";

export const digest = async (value: string | Uint8Array) =>
	base64url.encode(
		new Uint8Array(
			await crypto.subtle.digest(
				"SHA-256",
				typeof value === "string"
					? new TextEncoder().encode(value)
					: new Uint8Array(value),
			),
		),
	);
export async function createIdentity() {
	const pair = await generateKeyPair("ES256", { extractable: false });
	const publicJwk = PublicJwk.parse(await exportJWK(pair.publicKey));
	return {
		privateKey: pair.privateKey,
		publicJwk,
		subject: await calculateJwkThumbprint(publicJwk),
		credential: "",
	} as Identity;
}
export async function sign(value: unknown, key: CryptoKey) {
	return new CompactSign(jsonBytes(value))
		.setProtectedHeader({ alg: "ES256", typ: "mesh+jws" })
		.sign(key);
}
export async function verify(value: string, jwk: JsonWebKey) {
	if (value.length > 20000) throw new Error("Prova acima do limite.");
	const result = await compactVerify(
		value,
		await importJWK(jwk as JWK, "ES256"),
		{ algorithms: ["ES256"] },
	);
	if (result.protectedHeader.typ !== "mesh+jws")
		throw new Error("Tipo de prova incompatível.");
	return JSON.parse(
		new TextDecoder("utf-8", { fatal: true }).decode(result.payload),
	) as unknown;
}
export async function verifyMember(
	credential: string,
	trust: Trust,
	now = seconds(),
): Promise<Member> {
	const member = CredentialClaims.parse(
		await verify(credential, trust.signing_jwk),
	);
	if (
		member.exp <= now ||
		member.nbf > now + SKEW_SECONDS ||
		member.iat > now + SKEW_SECONDS ||
		member.exp - member.iat > 86400 ||
		trust.revoked.includes(member.sub)
	)
		throw new Error("Participante expirado, revogado ou relógio inválido.");
	if ((await calculateJwkThumbprint(member.jwk)) !== member.sub)
		throw new Error("Identidade inconsistente.");
	return member;
}
export async function sealIncident(
	incident: Incident,
	writeKey: string,
	identity: Identity,
	trust: Trust,
	now = seconds(),
	maxHops = 4,
): Promise<Envelope> {
	IncidentSchema.parse(incident);
	if (!/^[a-f0-9]{64}$/.test(writeKey))
		throw new Error("Chave de envio inválida.");
	const member = await verifyMember(identity.credential, trust, now);
	if (member.sub !== identity.subject)
		throw new Error("Credencial não corresponde à instalação.");
	const plaintext = jsonBytes({ incident, write_key: writeKey });
	if (plaintext.length > 10000)
		throw new Error(
			"Conteúdo essencial excede o limite mesh; envio direto preservado.",
		);
	const sealed = await new CompactEncrypt(plaintext)
		.setProtectedHeader({
			alg: "RSA-OAEP-256",
			enc: "A256GCM",
			kid: trust.authority_id,
			typ: "mesh+jwe",
		})
		.encrypt(await importJWK(trust.encryption_jwk as JWK, "RSA-OAEP-256"));
	const origin = OriginClaims.parse({
		kind: "mesh-origin",
		version: 1,
		message_id: crypto.randomUUID(),
		created: now,
		expires: Math.min(now + 43200, member.exp),
		max_hops: maxHops,
		payload_size: new TextEncoder().encode(sealed).length,
		cipher_hash: await digest(sealed),
		priority: "normal",
	});
	return {
		version: 1,
		origin_credential: identity.credential,
		sealed,
		origin_proof: await sign(origin, identity.privateKey),
		hops: [],
	};
}
export async function verifyEnvelope(
	input: unknown,
	trust: Trust,
	now = seconds(),
): Promise<VerifiedEnvelope> {
	if (jsonBytes(input).length > MAX_ENVELOPE_BYTES)
		throw new Error("Envelope acima do limite.");
	const envelope = EnvelopeSchema.parse(input);
	const member = await verifyMember(envelope.origin_credential, trust, now);
	const origin = OriginClaims.parse(
		await verify(envelope.origin_proof, member.jwk),
	);
	if (
		origin.created > now + SKEW_SECONDS ||
		origin.expires <= now ||
		origin.expires <= origin.created ||
		origin.expires - origin.created > 43200 ||
		origin.expires > member.exp
	)
		throw new Error("Envelope expirado ou relógio incoerente.");
	if (
		new TextEncoder().encode(envelope.sealed).length !== origin.payload_size ||
		origin.payload_size > MAX_SEALED_BYTES ||
		(await digest(envelope.sealed)) !== origin.cipher_hash
	)
		throw new Error("Conteúdo adulterado ou incompleto.");
	const header = decodeProtectedHeader(envelope.sealed);
	if (
		header.alg !== "RSA-OAEP-256" ||
		header.enc !== "A256GCM" ||
		header.kid !== trust.authority_id ||
		header.typ !== "mesh+jwe" ||
		header.zip
	)
		throw new Error("Cifragem incompatível.");
	if (envelope.hops.length > origin.max_hops)
		throw new Error("Limite de saltos excedido.");
	const originHash = await digest(envelope.origin_proof);
	let holder = member.sub,
		previous = originHash;
	const visited = [holder];
	for (const [index, item] of envelope.hops.entries()) {
		const sender = await verifyMember(item.credential, trust, now);
		const hop = HopClaims.parse(await verify(item.proof, sender.jwk));
		if (
			sender.sub !== holder ||
			hop.sender !== holder ||
			hop.index !== index + 1 ||
			hop.previous !== previous ||
			hop.origin_hash !== originHash ||
			hop.message_id !== origin.message_id ||
			visited.includes(hop.receiver) ||
			hop.at > now + SKEW_SECONDS ||
			hop.at < origin.created - SKEW_SECONDS
		)
			throw new Error("Cadeia de saltos inválida ou ciclo.");
		holder = hop.receiver;
		visited.push(holder);
		previous = await digest(item.proof);
	}
	return { envelope, origin, originHash, holder, visited };
}
export async function appendHop(
	envelope: Envelope,
	identity: Identity,
	receiverCredential: string,
	trust: Trust,
	now = seconds(),
) {
	const checked = await verifyEnvelope(envelope, trust, now),
		receiver = await verifyMember(receiverCredential, trust, now);
	if (
		checked.holder !== identity.subject ||
		checked.visited.includes(receiver.sub) ||
		envelope.hops.length >= checked.origin.max_hops
	)
		throw new Error(
			"Encaminhamento recusado: dono, ciclo ou limite de saltos.",
		);
	const proof = await sign(
		HopClaims.parse({
			kind: "mesh-hop",
			message_id: checked.origin.message_id,
			origin_hash: checked.originHash,
			previous: envelope.hops.length
				? await digest(envelope.hops.at(-1)!.proof)
				: checked.originHash,
			sender: identity.subject,
			receiver: receiver.sub,
			index: envelope.hops.length + 1,
			transmission_id: crypto.randomUUID(),
			at: now,
		}),
		identity.privateKey,
	);
	return {
		...envelope,
		hops: [...envelope.hops, { credential: identity.credential, proof }],
	};
}
export async function verifyServerReceipt(proof: string, trust: Trust) {
	return ReceiptClaims.parse(await verify(proof, trust.signing_jwk));
}
