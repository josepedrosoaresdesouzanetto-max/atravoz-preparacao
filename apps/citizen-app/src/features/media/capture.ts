import { AttachmentSchema } from "../../../../../packages/contracts/src";
import type { MediaItem } from "../offline-storage/store";

export async function makeMedia(
	blob: Blob,
	kind: "audio" | "photo",
	original?: Blob,
): Promise<MediaItem> {
	if (blob.size > 4 * 1024 * 1024)
		throw new Error("Anexo acima de 4 MB. Escolha um arquivo menor.");
	const sha = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
	const manifest = AttachmentSchema.parse({
		attachment_id: crypto.randomUUID(),
		kind,
		mime_type: blob.type.split(";")[0],
		byte_size: blob.size,
		sha256: Array.from(new Uint8Array(sha), (v) =>
			v.toString(16).padStart(2, "0"),
		).join(""),
	});
	return { manifest, blob, original };
}
export async function preparePhoto(file: File): Promise<MediaItem> {
	if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
		throw new Error("Selecione uma imagem JPEG, PNG ou WebP.");
	if (file.size > 12 * 1024 * 1024)
		throw new Error("Original acima de 12 MB. Escolha uma foto menor.");
	const bitmap = await createImageBitmap(file);
	try {
		if (bitmap.width * bitmap.height > 32_000_000)
			throw new Error("Dimensões muito grandes. Escolha uma imagem menor.");
		const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Não foi possível preparar a imagem.");
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("Falha na imagem."))),
				"image/jpeg",
				0.85,
			),
		);
		return makeMedia(blob, "photo", file);
	} finally {
		bitmap.close();
	}
}
export class AudioCapture {
	private recorder: MediaRecorder | null = null;
	private stream: MediaStream | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	async start(
		onReady: (media: MediaItem) => void,
		onError: (message: string) => void,
	) {
		if (
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === "undefined"
		)
			throw new Error("Gravação indisponível. Você pode salvar sem áudio.");
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mime = [
			"audio/webm;codecs=opus",
			"audio/mp4",
			"audio/ogg;codecs=opus",
		].find((v) => MediaRecorder.isTypeSupported(v));
		if (!mime) {
			this.cleanup();
			throw new Error("Formato de áudio não compatível. Salve sem áudio.");
		}
		try {
			this.recorder = new MediaRecorder(this.stream, {
				mimeType: mime,
				audioBitsPerSecond: 32000,
			});
		} catch (e) {
			this.cleanup();
			throw e;
		}
		const chunks: Blob[] = [];
		this.recorder.ondataavailable = (e) => {
			if (e.data.size) chunks.push(e.data);
		};
		this.recorder.onstop = async () => {
			this.cleanup();
			try {
				onReady(
					await makeMedia(
						new Blob(chunks, { type: mime.split(";")[0] }),
						"audio",
					),
				);
			} catch (e) {
				onError(String(e));
			}
		};
		this.recorder.onerror = () => {
			this.cleanup();
			onError("Falha na gravação. Você pode salvar sem áudio.");
		};
		this.recorder.start();
		this.timer = setTimeout(() => this.stop(), 30000);
	}
	stop() {
		if (this.recorder?.state === "recording") this.recorder.stop();
	}
	private cleanup() {
		if (this.timer) clearTimeout(this.timer);
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
	}
}
