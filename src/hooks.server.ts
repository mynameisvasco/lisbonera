import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { verifyAccess } from '#lib/server/auth/access.js';

/** Every dashboard request needs a valid Cloudflare Access assertion for the configured owner email. */
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname === '/') redirect(307, '/admin');

	if (pathname === '/admin' || pathname.startsWith('/admin/')) {
		const identity = dev ? { email: 'dev@localhost' } : await verifyAccess(event.request, env);
		if (!identity) error(403, 'This dashboard is protected by Cloudflare Access.');
		event.locals.admin = identity;
	}

	return resolve(event);
};
