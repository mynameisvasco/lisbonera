<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button, type ButtonVariant } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	let {
		pending = false,
		disabled = false,
		variant = 'default',
		class: className,
		children
	}: {
		pending?: boolean;
		disabled?: boolean;
		variant?: ButtonVariant;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<!-- Keeps its width while pending: the spinner replaces nothing, it is added in front. -->
<Button
	type="submit"
	{variant}
	disabled={pending || disabled}
	class={className}
	aria-busy={pending}
>
	{#if pending}<Spinner />{/if}
	{@render children()}
</Button>
