<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';

	let {
		title,
		href,
		meta,
		error,
		muted = false,
		dragging = false,
		attach,
		leading,
		media,
		trailing,
		children
	}: {
		title: string;
		href?: string;
		/** Secondary line, e.g. `Source · Type`. */
		meta?: Snippet | string;
		error?: string | null;
		/** Disabled or hidden items keep their place but recede. */
		muted?: boolean;
		dragging?: boolean;
		attach?: Attachment<HTMLElement>;
		/** Drag handle and position, before the media. */
		leading?: Snippet;
		media?: Snippet;
		/** Switches and the actions menu. */
		trailing?: Snippet;
		/** Extra content below the text, such as a device's sessions. */
		children?: Snippet;
	} = $props();
	const noop: Attachment<HTMLElement> = () => {};
</script>

<li
	{@attach attach ?? noop}
	class={[
		'bg-background py-3',
		dragging && 'relative z-20 rounded-lg shadow-lg ring-1 ring-border'
	]}
>
	<div class="flex min-h-10 items-center gap-3 sm:gap-4">
		{@render leading?.()}
		{#if media}
			<div class={['flex shrink-0', muted && 'opacity-40 grayscale']}>
				{@render media()}
			</div>
		{/if}
		<div class={['min-w-0 flex-1', muted && 'opacity-60']}>
			{#if href}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolved href -->
				<a {href} class="block truncate text-sm font-medium underline-offset-4 hover:underline"
					>{title}</a
				>
			{:else}
				<p class="truncate text-sm font-medium">{title}</p>
			{/if}
			{#if typeof meta === 'string'}
				<p class="truncate text-xs text-muted-foreground">{meta}</p>
			{:else if meta}
				<div class="truncate text-xs text-muted-foreground">{@render meta()}</div>
			{/if}
			{#if error}
				<p class="mt-0.5 text-xs break-words text-terracotta">{error}</p>
			{/if}
		</div>
		{#if trailing}
			<div class="flex shrink-0 items-center gap-1 sm:gap-2">{@render trailing()}</div>
		{/if}
	</div>
	{@render children?.()}
</li>
