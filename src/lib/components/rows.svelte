<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	let {
		ordered = false,
		class: className,
		children
	}: { ordered?: boolean; class?: string; children: Snippet } = $props();
</script>

{#if ordered}
	<ol class={cn('divide-y border-y', className)}>{@render children()}</ol>
{:else}
	<ul class={cn('divide-y border-y', className)}>{@render children()}</ul>
{/if}
