import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Native Jellyfin clients POST without an Origin header, which SvelteKit's built-in check rejects.
			// '*' is the supported way to turn that check off; src/hooks.server.ts applies it to everything else.
			csrf: { trustedOrigins: ['*'] }
		})
	],
	// Ships .svelte files without a `svelte` export condition, so SSR must bundle it.
	ssr: { noExternal: ['@dnd-kit/svelte'] }
});
