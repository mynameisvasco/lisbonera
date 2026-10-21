<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, description, actions }: { title: string; description?: string; actions?: Snippet } =
		$props();
</script>

<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
	<div class="max-w-2xl space-y-1.5">
		<h1 class="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{title}</h1>
		{#if description}
			<p class="text-sm text-pretty text-muted-foreground">{description}</p>
		{/if}
	</div>
	{@render actions?.()}
</div>
