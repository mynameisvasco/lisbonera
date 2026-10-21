<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SHAPE_ASPECT, type Shape } from '#lib/shapes.js';
	import { cn } from '#lib/utils.js';

	let {
		src,
		title,
		shape = 'poster',
		aspect,
		class: className,
		children
	}: {
		src: string | null;
		title: string;
		shape?: Shape;
		/** Overrides `shape` with an exact width / height ratio. */
		aspect?: number | null;
		class?: string;
		/** Overlay controls. */
		children?: Snippet;
	} = $props();

	let failed = $state(false);
	$effect(() => {
		void src;
		failed = false;
	});
</script>

<div
	class={cn('relative overflow-hidden rounded-md bg-muted ring-1 ring-foreground/5', className)}
	style:aspect-ratio={aspect ?? SHAPE_ASPECT[shape]}
>
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
			<span class="line-clamp-3 text-2xs text-muted-foreground">{title}</span>
		</div>
	{/if}
	{@render children?.()}
</div>
