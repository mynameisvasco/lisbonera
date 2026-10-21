<script lang="ts">
	import { enhance } from '$app/forms';
	import { Switch } from '#lib/components/ui/switch/index.js';

	let {
		action,
		id,
		checked,
		label
	}: { action: string; id: string; checked: boolean; label: string } = $props();
	let form: HTMLFormElement;
	let value = $derived(checked);
</script>

<form method="POST" {action} use:enhance bind:this={form}>
	<input type="hidden" name="id" value={id} />
	<input type="hidden" name="enabled" value={String(value)} />
	<Switch
		checked={value}
		aria-label={label}
		onCheckedChange={(next) => {
			value = next;
			queueMicrotask(() => form.requestSubmit());
		}}
	/>
</form>
