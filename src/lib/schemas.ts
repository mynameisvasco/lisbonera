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
