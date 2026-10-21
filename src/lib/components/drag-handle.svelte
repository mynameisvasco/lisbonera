<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';

	let { attach, label }: { attach: Attachment<HTMLElement>; label: string } = $props();
</script>

<button
	type="button"
	{@attach attach}
	class="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing [@media(hover:none)]:size-10"
	aria-label={label}
>
	<DotsSixVerticalIcon class="size-4" weight="bold" />
</button>
