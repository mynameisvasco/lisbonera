<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUp';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDown';

	let {
		action = '?/move',
		id,
		first,
		last,
		idField = 'id'
	}: { action?: string; id: string; first: boolean; last: boolean; idField?: string } = $props();
</script>

<form method="POST" {action} use:enhance class="flex">
	<input type="hidden" name={idField} value={id} />
	<Button
		type="submit"
		name="direction"
		value="up"
		variant="ghost"
		size="icon-sm"
		disabled={first}
		aria-label="Move up"
	>
		<ArrowUpIcon />
	</Button>
	<Button
		type="submit"
		name="direction"
		value="down"
		variant="ghost"
		size="icon-sm"
		disabled={last}
		aria-label="Move down"
	>
		<ArrowDownIcon />
	</Button>
</form>
