/** Query string reader with case-insensitive names: Jellyfin clients disagree on casing (`ParentId` vs `parentId`). */
export class Query {
	readonly #values = new Map<string, string[]>();

	constructor(params: URLSearchParams) {
		for (const [key, value] of params) {
			const name = key.toLowerCase();
			const list = this.#values.get(name);
			if (list) list.push(value);
			else this.#values.set(name, [value]);
		}
	}

	get(name: string): string | undefined {
		const value = this.#values.get(name.toLowerCase())?.[0];
		return value === '' ? undefined : value;
	}

	int(name: string, fallback: number): number {
		const value = Number.parseInt(this.get(name) ?? '', 10);
		return Number.isFinite(value) && value >= 0 ? value : fallback;
	}

	/** Comma-separated or repeated values, e.g. `Fields=A,B` or `Ids=a&Ids=b`. */
	list(name: string): string[] {
		return (this.#values.get(name.toLowerCase()) ?? [])
			.flatMap((value) => value.split(','))
			.map((value) => value.trim())
			.filter(Boolean);
	}

	bool(name: string): boolean | undefined {
		const value = this.get(name)?.toLowerCase();
		if (value === 'true') return true;
		if (value === 'false') return false;
		return undefined;
	}
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
	return Response.json(data, { status, headers });
}

export function noContent(): Response {
	return new Response(null, { status: 204 });
}

export function notFound(): Response {
	return json({ message: 'Not found' }, 404);
}

export function unauthorized(): Response {
	return json({ message: 'Unauthorized' }, 401);
}

export function redirect(location: string): Response {
	return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });
}

/** Reads a JSON body without failing on empty or malformed bodies, which several clients send. */
export async function readJson<T>(request: Request): Promise<Partial<T>> {
	try {
		const text = await request.text();
		return text ? (JSON.parse(text) as Partial<T>) : {};
	} catch {
		return {};
	}
}
