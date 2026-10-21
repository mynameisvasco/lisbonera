<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		tone = 'success',
		class: className
	}: { tone?: 'success' | 'warning' | 'muted'; class?: string } = $props();
</script>

<span
	class={cn(
		'relative inline-flex size-2 shrink-0 rounded-full',
		tone === 'success' && 'bg-success',
		tone === 'warning' && 'bg-terracotta',
		tone === 'muted' && 'bg-muted-foreground/40',
		className
	)}
>
	{#if tone === 'success'}
		<span class="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:hidden"
		></span>
	{/if}
</span>
