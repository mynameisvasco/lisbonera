const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FORM_TYPES = new Set([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
]);

/**
 * The cross-site form check SvelteKit runs by default, kept for everything outside the Jellyfin API.
 * A mutating request is rejected when it could come from a plain HTML form (form content type or none)
 * and its `Origin` is not this server.
 */
export function isCrossSiteFormSubmission(request: Request, origin: string): boolean {
	if (!MUTATING_METHODS.has(request.method)) return false;
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (type && !FORM_TYPES.has(type)) return false;
	return request.headers.get('origin') !== origin;
}
