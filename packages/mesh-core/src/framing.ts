import { z } from "zod";
import { digest } from "./security";
const frameSchema = z
	.object({
		id: z.string().uuid(),
		index: z.number().int().min(0).max(35),
		total: z.number().int().min(1).max(36),
		hash: z.string().length(43),
		data: z.string().max(2000),
	})
	.strict();
export async function fragment(value: unknown) {
	const data = JSON.stringify(value);
	if (new TextEncoder().encode(data).length > 70000)
		throw new Error("Pacote acima do limite.");
	const id = crypto.randomUUID(),
		hash = await digest(data),
		total = Math.ceil(data.length / 2000);
	return Array.from({ length: total }, (_, index) =>
		JSON.stringify({
			id,
			index,
			total,
			hash,
			data: data.slice(index * 2000, (index + 1) * 2000),
		}),
	);
}
export class Reassembler {
	private pending = new Map<
		string,
		{
			until: number;
			total: number;
			hash: string;
			parts: Map<number, string>;
			bytes: number;
		}
	>();
	constructor(readonly now = () => Date.now()) {}
	async accept(raw: string) {
		if (typeof raw !== "string" || raw.length > 13000)
			throw new Error("Fragmento inválido.");
		this.expire();
		const f = frameSchema.parse(JSON.parse(raw));
		if (f.index >= f.total) throw new Error("Índice inválido.");
		let entry = this.pending.get(f.id);
		if (!entry) {
			if (this.pending.size >= 2) throw new Error("Limite de remontagens.");
			entry = {
				until: this.now() + 10000,
				total: f.total,
				hash: f.hash,
				parts: new Map(),
				bytes: 0,
			};
			this.pending.set(f.id, entry);
		}
		if (entry.total !== f.total || entry.hash !== f.hash) {
			this.pending.delete(f.id);
			throw new Error("Fragmentos incompatíveis.");
		}
		const previous = entry.parts.get(f.index);
		if (previous !== undefined && previous !== f.data) {
			this.pending.delete(f.id);
			throw new Error("Fragmento adulterado.");
		}
		if (previous === undefined) {
			entry.parts.set(f.index, f.data);
			entry.bytes += new TextEncoder().encode(f.data).length;
		}
		if (entry.bytes > 70000) {
			this.pending.delete(f.id);
			throw new Error("Remontagem acima do limite.");
		}
		if (entry.parts.size !== entry.total) return null;
		this.pending.delete(f.id);
		const data = Array.from({ length: entry.total }, (_, i) =>
			entry!.parts.get(i),
		).join("");
		if ((await digest(data)) !== entry.hash)
			throw new Error("Pacote corrompido.");
		return JSON.parse(data) as unknown;
	}
	expire() {
		for (const [id, e] of this.pending)
			if (e.until <= this.now()) this.pending.delete(id);
	}
	clear() {
		this.pending.clear();
	}
	get size() {
		this.expire();
		return this.pending.size;
	}
}
