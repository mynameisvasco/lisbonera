<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, action }: { children: Snippet; action?: Snippet } = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-3 border-y py-6 text-sm">
	<p class="text-muted-foreground">{@render children()}</p>
	{#if action}{@render action()}{/if}
</div>
