<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		src,
		title,
		class: className
	}: { src: string | null; title: string; class?: string } = $props();

	let failed = $state(false);
</script>

<div class={cn('relative aspect-[2/3] overflow-hidden rounded-md bg-muted', className)}>
	{#if src && !failed}
		<img
			{src}
			alt={title}
			loading="lazy"
			decoding="async"
			draggable="false"
			class="size-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<div class="flex size-full items-end p-2">
			<span class="line-clamp-3 text-[11px] leading-tight text-muted-foreground">{title}</span>
		</div>
	{/if}
</div>
