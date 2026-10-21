<script lang="ts">
	import LogoMark from './logo-mark.svelte';
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();
</script>

<span class={cn('inline-flex items-center gap-2', className)}>
	<LogoMark class="size-7 shrink-0" />
	<span class="text-[1.05rem] font-semibold tracking-[-0.03em]">lisbonera</span>
</span>
