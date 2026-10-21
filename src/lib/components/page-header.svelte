<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, meta, actions }: { title: string; meta?: Snippet | string; actions?: Snippet } =
		$props();
</script>

<header class="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
	<div class="min-w-0 space-y-1">
		<h1 class="text-[28px] leading-8 font-semibold tracking-[-0.02em]">{title}</h1>
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
