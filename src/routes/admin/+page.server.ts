import { env } from 'cloudflare:workers';
import { libraryPreviews } from '#lib/server/admin/previews.js';
import { adminScope } from '#lib/server/admin/scope.js';
import { listAppPasswords, listSessions } from '#lib/server/auth/client.js';
import { listAccounts } from '#lib/server/scrobble/service.js';
import { enabledLibraries, listAddons } from '#lib/server/store.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [addons, libraries, passwords, sessions, accounts] = await Promise.all([
		listAddons(env.DB),
		enabledLibraries(env.DB),
		listAppPasswords(env.DB),
		listSessions(env.DB),
		listAccounts(env.DB)
	]);
	const previews = await libraryPreviews(adminScope(event), libraries, 14);
	const enabledAddons = addons.filter((addon) => addon.enabled);
	const scrobbler = accounts.find((account) => account.active) ?? null;

	return {
		server: event.url.origin,
		host: event.url.host,
		username: env.JELLYFIN_USERNAME || 'admin',
		addons: {
			enabled: enabledAddons.length,
			failing: enabledAddons.filter((addon) => addon.lastError).length,
			streams: enabledAddons.filter((addon) =>
				addon.manifest?.resources.some(
					(resource) => (typeof resource === 'string' ? resource : resource.name) === 'stream'
				)
			).length
		},
		devices: {
			passwords: passwords.length,
			lastSeen: sessions[0] ? { client: sessions[0].client, at: sessions[0].lastSeenAt } : null
		},
		scrobbler: scrobbler
			? {
					provider: scrobbler.provider,
					username: scrobbler.username,
					failing: Boolean(scrobbler.lastError)
				}
			: null,
		shelves: libraries.map((library) => ({
			id: library.id,
			name: library.name,
			type: library.catalogType,
			items: previews[library.id] ?? []
		}))
	};
};
