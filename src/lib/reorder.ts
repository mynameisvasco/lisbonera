/** Moves the item at `from` by `delta` places; out-of-range moves return the same array. */
export function shift<T>(items: T[], from: number, delta: number): T[] {
	const to = from + delta;
	if (to < 0 || to >= items.length) return items;
	const next = [...items];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}
