<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		tone = 'success',
		class: className
	}: { tone?: 'success' | 'warning' | 'muted'; class?: string } = $props();
</script>

<span
	aria-hidden="true"
	class={cn(
		'inline-block size-1.5 shrink-0 rounded-full',
		tone === 'success' && 'bg-success',
		tone === 'warning' && 'bg-terracotta',
		tone === 'muted' && 'bg-muted-foreground/40',
		className
	)}
></span>
