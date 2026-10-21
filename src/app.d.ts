// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			admin?: { email: string };
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
