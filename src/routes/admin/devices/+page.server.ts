import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { appPasswordSchema } from '#lib/schemas.js';
import { field } from '#lib/server/admin/forms.js';
import {
	createAppPassword,
	listAppPasswords,
	listSessions,
	revokeAppPassword,
	revokeSession
} from '#lib/server/auth/client.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = env.DB;
	const [passwords, sessions] = await Promise.all([listAppPasswords(db), listSessions(db)]);
	return {
		form: await superValidate(zod4(appPasswordSchema)),
		passwords,
		sessions: sessions.map((session) => ({
			tokenHash: session.tokenHash,
			label: session.label,
			client: session.client,
			device: session.device,
			version: session.version,
			lastSeenAt: session.lastSeenAt
		}))
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await superValidate(request, zod4(appPasswordSchema));
		if (!form.valid) return fail(400, { form });
		const { password } = await createAppPassword(env.DB, form.data.label);
		return { form, created: { label: form.data.label, password } };
	},
	revoke: async ({ request }) => {
		await revokeAppPassword(env.DB, field(await request.formData(), 'id'));
	},
	signOut: async ({ request }) => {
		await revokeSession(env.DB, field(await request.formData(), 'tokenHash'));
	}
};
