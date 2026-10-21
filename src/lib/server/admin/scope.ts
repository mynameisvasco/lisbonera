import { env, waitUntil } from 'cloudflare:workers';
import { createScope, type Scope } from '../scope';

export function adminScope(event: { url: URL }): Scope {
	return createScope(env, { waitUntil }, event.url);
}
