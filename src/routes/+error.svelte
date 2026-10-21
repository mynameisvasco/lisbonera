<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Lisbonera</title></svelte:head>

<main class="flex min-h-svh items-center justify-center p-6">
	<div class="max-w-sm space-y-2 text-center">
		<p class="font-mono text-sm text-muted-foreground">{page.status}</p>
		<h1 class="text-lg font-semibold">{page.error?.message}</h1>
	</div>
</main>
