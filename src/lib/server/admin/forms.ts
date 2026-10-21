import { error } from '@sveltejs/kit';

export function field(data: FormData, name: string): string {
	const value = data.get(name);
	if (typeof value !== 'string' || value === '') error(400, `Missing field: ${name}`);
	return value;
}

/** Reads a JSON array of ids and keeps only known ones, in the submitted order. */
export function orderedIds(data: FormData, known: string[]): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(field(data, 'ids'));
	} catch {
		error(400, 'Invalid order');
	}
	if (!Array.isArray(parsed)) error(400, 'Invalid order');
	const allowed = new Set(known);
	const ids = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id));
	return [...new Set(ids), ...known.filter((id) => !ids.includes(id))];
}
