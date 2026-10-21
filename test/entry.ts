import { createWorker } from '../src/lib/server/app';

/** Stands in for the SvelteKit worker so tests can tell which side handled a request. */
export default createWorker({
	fetch: () => new Response('sveltekit')
});
