import { env, waitUntil } from 'cloudflare:workers';
import { dev } from '$app/env';
import { error, redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { verifyAccess } from '#lib/server/auth/access.js';
import { isCrossSiteFormSubmission } from '#lib/server/csrf.js';
import { handleJellyfin, isJellyfinPath } from '#lib/server/jellyfin/api.js';

/** Jellyfin clients get the API directly, without SvelteKit routing. */
const jellyfin: Handle = ({ event, resolve }) => {
	if (!isJellyfinPath(event.url.pathname)) return resolve(event);
	return handleJellyfin(event.request, env, { waitUntil });
};

/** SvelteKit's own check is disabled in vite.config.ts for the API; the dashboard keeps it. */
const csrf: Handle = ({ event, resolve }) => {
	if (!dev && isCrossSiteFormSubmission(event.request, event.url.origin)) {
		error(403, `Cross-site ${event.request.method} form submissions are forbidden`);
	}
	return resolve(event);
};

/** Every dashboard request needs a valid Cloudflare Access assertion for the configured owner email. */
const access: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname === '/') redirect(307, '/admin');

	if (pathname === '/admin' || pathname.startsWith('/admin/')) {
		const identity = dev ? { email: 'dev@localhost' } : await verifyAccess(event.request, env);
		if (!identity) error(403, 'This dashboard is protected by Cloudflare Access.');
		event.locals.admin = identity;
	}

	return resolve(event);
};

export const handle = sequence(jellyfin, csrf, access);
