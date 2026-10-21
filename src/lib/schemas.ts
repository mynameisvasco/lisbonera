import { z } from 'zod';

export const addonSchema = z.object({
	url: z.string().trim().min(1, 'Enter the manifest URL')
});

export const renameSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1, 'Enter a name').max(80)
});

export const collectionSchema = z.object({
	name: z.string().trim().min(1, 'Enter a name').max(80),
	type: z.enum(['movie', 'series', 'mixed'])
});

export const appPasswordSchema = z.object({
	label: z.string().trim().min(1, 'Name the device').max(60)
});

export const credentialsSchema = z.object({
	provider: z.string().min(1),
	clientId: z.string().trim().min(1, 'Enter the client ID'),
	clientSecret: z.string().trim().min(1, 'Enter the client secret')
});

export const genreCollectionsSchema = z.object({
	catalog: z.string().min(1, 'Choose a catalog'),
	genres: z.array(z.string().min(1)).min(1, 'Choose at least one genre').max(40)
});

export const listSchema = z.object({
	list: z.string().trim().min(1, 'Paste a list URL').max(300),
	name: z.string().trim().max(80).default('')
});

export const mdblistKeySchema = z.object({
	key: z.string().trim().min(8, 'Paste your MDBList API key').max(200)
});
