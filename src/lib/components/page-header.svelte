<script lang="ts">
	import type { Snippet } from 'svelte';
	import BackLink from './back-link.svelte';

	let {
		title,
		meta,
		actions,
		back
	}: {
		title: string;
		meta?: Snippet | string;
		actions?: Snippet;
		back?: { href: string; label: string };
	} = $props();
</script>

{#if back}<BackLink {...back} />{/if}
<header class="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
	<div class="min-w-0 space-y-1">
		<h1 class="text-title text-balance">{title}</h1>
		{#if typeof meta === 'string'}
			<p class="text-sm text-muted-foreground">{meta}</p>
		{:else if meta}
			<div class="text-sm text-muted-foreground">{@render meta()}</div>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-2">{@render actions()}</div>
	{/if}
</header>
