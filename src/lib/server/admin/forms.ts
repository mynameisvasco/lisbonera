import { error } from '@sveltejs/kit';

export function field(data: FormData, name: string): string {
	const value = data.get(name);
	if (typeof value !== 'string' || value === '') error(400, `Missing field: ${name}`);
	return value;
}

/** Returns `ids` with `id` swapped with its neighbour in `direction`. */
export function moved(ids: string[], id: string, direction: string): string[] {
	const index = ids.indexOf(id);
	const target = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || target < 0 || target >= ids.length) return ids;
	const next = [...ids];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}
