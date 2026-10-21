import { loadPendingManifests } from '#lib/server/admin/addons.js';
import { adminScope } from '#lib/server/admin/scope.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	await loadPendingManifests(adminScope(event));
	return { email: event.locals.admin?.email ?? '' };
};
