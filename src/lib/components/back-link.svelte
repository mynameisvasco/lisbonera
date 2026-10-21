<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';

	let { href, label }: { href: string; label: string } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass a resolved href -->
<a
	{href}
	class="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeftIcon class="size-3.5" />
	{label}
</a>
