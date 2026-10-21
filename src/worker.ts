// wrangler.adapter.jsonc tells the SvelteKit adapter to write its worker to .svelte-kit/cloudflare/_worker.js,
// which wrangler.jsonc aliases as `sveltekit-worker`.
import kit from 'sveltekit-worker';
import { createWorker } from './lib/server/app';

export default createWorker(kit);
