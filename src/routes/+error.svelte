<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>{page.status} · Lisbonera</title></svelte:head>

<main class="flex min-h-svh items-center justify-center p-6">
	<div class="max-w-sm space-y-3 text-center">
		<p class="font-mono text-sm text-muted-foreground">{page.status}</p>
		<h1 class="text-lg font-semibold">{page.error?.message}</h1>
		{#if page.status !== 403}
			<a href={resolve('/admin')} class="text-sm text-primary underline-offset-4 hover:underline"
				>Back to overview</a
			>
		{/if}
	</div>
</main>
