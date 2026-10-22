<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	let {
		tone = 'info',
		class: className,
		children
	}: { tone?: 'info' | 'warning'; class?: string; children: Snippet } = $props();
</script>

<div
	role={tone === 'warning' ? 'alert' : undefined}
	class={cn(
		'max-w-2xl border-l-2 pl-3 text-sm',
		tone === 'warning' ? 'border-terracotta' : 'border-primary text-muted-foreground',
		className
	)}
>
	{@render children()}
</div>
