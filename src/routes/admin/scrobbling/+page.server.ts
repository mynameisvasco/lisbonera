import { env } from 'cloudflare:workers';
import { error, fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { credentialsSchema } from '#lib/schemas.js';
import { field } from '#lib/server/admin/forms.js';
import {
	clearDevice,
	pendingDevice,
	pollConnection,
	startConnection
} from '#lib/server/admin/scrobbling.js';
import {
	disconnect,
	getProviderDefinition,
	listAccounts,
	loadCredentials,
	providers,
	saveCredentials,
	setActive
} from '#lib/server/scrobble/service.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const accounts = await listAccounts(env.DB);
	return {
		providers: await Promise.all(
			providers.map(async (provider) => {
				const credentials = await loadCredentials(env, provider.id);
				const device = await pendingDevice(env.DB, provider.id);
				return {
					id: provider.id,
					name: provider.name,
					notice: provider.notice ?? null,
					credentialsUrl: provider.credentialsUrl,
					clientId: credentials?.clientId ?? null,
					account: accounts.find((account) => account.provider === provider.id) ?? null,
					device: device
						? {
								userCode: device.userCode,
								verificationUrl: device.verificationUrl,
								interval: device.interval,
								expiresAt: device.expiresAt
							}
						: null,
					form: await superValidate(
						{ provider: provider.id, clientId: credentials?.clientId ?? '', clientSecret: '' },
						zod4(credentialsSchema),
						{ id: `credentials-${provider.id}`, errors: false }
					)
				};
			})
		)
	};
};

function provider(data: FormData) {
	const id = field(data, 'provider');
	if (!getProviderDefinition(id)) error(400, 'Unknown provider');
	return id;
}

export const actions: Actions = {
	credentials: async ({ request }) => {
		const form = await superValidate(request, zod4(credentialsSchema));
		if (!form.valid || !getProviderDefinition(form.data.provider)) return fail(400, { form });
		await saveCredentials(env, form.data.provider, {
			clientId: form.data.clientId,
			clientSecret: form.data.clientSecret
		});
		return message(form, 'Credentials saved');
	},
	connect: async ({ request }) => {
		try {
			await startConnection(env, provider(await request.formData()));
		} catch (cause) {
			return fail(400, {
				error: cause instanceof Error ? cause.message : 'Could not start the connection'
			});
		}
	},
	poll: async ({ request }) => {
		const status = await pollConnection(env, provider(await request.formData()));
		if (status === 'failed')
			return fail(400, { error: 'The code expired or was denied. Start again.' });
		return { status };
	},
	cancel: async ({ request }) => {
		await clearDevice(env.DB, provider(await request.formData()));
	},
	activate: async ({ request }) => {
		const data = await request.formData();
		await setActive(env.DB, field(data, 'id'), field(data, 'enabled') === 'true');
	},
	disconnect: async ({ request }) => {
		await disconnect(env.DB, provider(await request.formData()));
	}
};
