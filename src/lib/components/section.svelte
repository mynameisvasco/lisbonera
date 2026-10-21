<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	let {
		id,
		title,
		description,
		actions,
		class: className,
		children
	}: {
		id: string;
		title: string;
		description?: Snippet | string;
		actions?: Snippet;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<!-- One heading style for every page section; sections are spaced by the page, not by each other. -->
<section aria-labelledby={id} class={cn('not-last:mb-12', className)}>
	<div class="mb-3 flex min-h-8 items-center justify-between gap-4">
		<h2 {id} class="text-label text-muted-foreground uppercase">{title}</h2>
		{#if actions}
			<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
	{#if typeof description === 'string'}
		<p class="-mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">{description}</p>
	{:else if description}
		<div class="-mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">{@render description()}</div>
	{/if}
	{@render children()}
</section>
