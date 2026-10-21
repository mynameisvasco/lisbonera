import { env } from 'cloudflare:workers';
import { listAppPasswords } from '#lib/server/auth/client.js';
import { listAccounts } from '#lib/server/scrobble/service.js';
import { enabledLibraries, listAddons } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [addons, libraries, passwords, accounts] = await Promise.all([
		listAddons(env.DB),
		enabledLibraries(env.DB),
		listAppPasswords(env.DB),
		listAccounts(env.DB)
	]);
	return {
		server: url.origin,
		username: env.JELLYFIN_USERNAME || 'admin',
		counts: {
			addons: addons.filter((addon) => addon.enabled).length,
			libraries: libraries.length,
			devices: passwords.length
		},
		scrobbler: accounts.find((account) => account.active)?.provider ?? null
	};
};
