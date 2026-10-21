const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600 * 1000],
	['month', 30 * 24 * 3600 * 1000],
	['day', 24 * 3600 * 1000],
	['hour', 3600 * 1000],
	['minute', 60 * 1000]
];

export function timeAgo(timestamp: number | null): string {
	if (!timestamp) return 'Never';
	const elapsed = timestamp - Date.now();
	for (const [unit, size] of UNITS) {
		if (Math.abs(elapsed) >= size) return relative.format(Math.round(elapsed / size), unit);
	}
	return 'Just now';
}
