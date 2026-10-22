<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';

	let {
		label,
		variant = 'ghost',
		children
	}: { label: string; variant?: 'ghost' | 'outline'; children: Snippet } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				{variant}
				size={variant === 'outline' ? 'icon' : 'icon-sm'}
				aria-label={label}
			>
				<DotsThreeIcon weight="bold" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="min-w-44">
		{@render children()}
	</DropdownMenu.Content>
</DropdownMenu.Root>
