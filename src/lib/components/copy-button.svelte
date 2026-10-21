<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import CopyIcon from 'phosphor-svelte/lib/Copy';
	import CheckIcon from 'phosphor-svelte/lib/Check';

	let { value, label = 'Copy' }: { value: string; label?: string } = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<Button variant="ghost" size="icon-sm" onclick={copy} aria-label={label}>
	{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
</Button>
