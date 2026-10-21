<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';

	let { action = '?/reorder' }: { action?: string } = $props();

	let form = $state<HTMLFormElement>();
	let value = $state('[]');

	/** Persists a new order through the page's `reorder` action. */
	export async function submit(ids: string[]) {
		value = JSON.stringify(ids);
		await tick();
		form?.requestSubmit();
	}
</script>

<form
	method="POST"
	{action}
	class="hidden"
	bind:this={form}
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
>
	<input type="hidden" name="ids" {value} />
</form>
