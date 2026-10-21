<script lang="ts">
	import { enhance } from '$app/forms';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { toast } from 'svelte-sonner';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';
	import DragHandle from '#lib/components/drag-handle.svelte';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { reportFailure } from '#lib/forms.js';
	import { timeAgo } from '#lib/format.js';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';

	interface Addon {
		id: string;
		url: string;
		host: string;
		name: string;
		version: string | null;
		logo: string | null;
		catalogs: number;
		libraries: number;
		resources: string[];
		enabled: boolean;
		lastError: string | null;
		checkedAt: number | null;
	}

	let {
		addon,
		index,
		count,
		onMove
	}: { addon: Addon; index: number; count: number; onMove: (delta: number) => void } = $props();

	const sortable = createSortable({
		get id() {
			return addon.id;
		},
		get index() {
			return index;
		}
	});

	let logoFailed = $state(false);
	let confirmRemove = $state(false);
	let refreshForm = $state<HTMLFormElement>();
	let removeForm = $state<HTMLFormElement>();

	const capabilities = $derived(
		[
			addon.resources.includes('stream') && 'Streams',
			addon.catalogs > 0 && `${addon.catalogs} ${addon.catalogs === 1 ? 'catalog' : 'catalogs'}`,
			addon.resources.includes('meta') && 'Metadata',
			addon.resources.includes('subtitles') && 'Subtitles'
		].filter(Boolean)
	);
</script>

<li
	{@attach sortable.attach}
	class={[
		'flex items-center gap-3 bg-background py-3 sm:gap-4',
		sortable.isDragging && 'relative z-20 rounded-md shadow-lg ring-1 ring-border'
	]}
>
	<DragHandle attach={sortable.attachHandle} label="Drag to change the priority of {addon.name}" />
	<span
		class="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums"
		title="Priority"
	>
		{index + 1}
	</span>

	<div
		class="hidden size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted sm:flex"
	>
		{#if addon.logo && !logoFailed}
			<img
				src={addon.logo}
				alt=""
				class="size-full object-contain p-1"
				onerror={() => (logoFailed = true)}
			/>
		{:else}
			<span class="text-xs font-medium text-muted-foreground"
				>{addon.name.slice(0, 1).toUpperCase()}</span
			>
		{/if}
	</div>

	<div class={['min-w-0 flex-1', !addon.enabled && 'opacity-50']}>
		<p class="truncate text-sm">
			<span class="font-medium">{addon.name}</span>
			{#if addon.version}<span class="ml-1 font-mono text-[11px] text-muted-foreground"
					>{addon.version}</span
				>{/if}
		</p>
		<p class="truncate text-xs text-muted-foreground" title={addon.url}>
			{capabilities.join(' · ') || addon.host}
		</p>
		{#if addon.lastError}
			<p class="mt-0.5 text-xs break-words text-terracotta">
				{addon.lastError} · {timeAgo(addon.checkedAt).toLowerCase()}
			</p>
		{/if}
	</div>

	<ToggleForm action="?/toggle" id={addon.id} checked={addon.enabled} label="Enable {addon.name}" />

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon-sm" aria-label="Actions for {addon.name}">
					<DotsThreeIcon weight="bold" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onSelect={() => refreshForm?.requestSubmit()}
				>Reload manifest</DropdownMenu.Item
			>
			<DropdownMenu.Item
				onSelect={async () => {
					await navigator.clipboard.writeText(`${addon.url}/manifest.json`);
					toast.success('Manifest URL copied');
				}}
			>
				Copy manifest URL
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item disabled={index === 0} onSelect={() => onMove(-1)}
				>Move up</DropdownMenu.Item
			>
			<DropdownMenu.Item disabled={index === count - 1} onSelect={() => onMove(1)}
				>Move down</DropdownMenu.Item
			>
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive" onSelect={() => (confirmRemove = true)}
				>Remove</DropdownMenu.Item
			>
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	<form
		method="POST"
		action="?/refresh"
		use:enhance={reportFailure}
		bind:this={refreshForm}
		class="hidden"
	>
		<input type="hidden" name="id" value={addon.id} />
	</form>
	<form method="POST" action="?/remove" use:enhance bind:this={removeForm} class="hidden">
		<input type="hidden" name="id" value={addon.id} />
	</form>
	<ConfirmDialog
		bind:open={confirmRemove}
		title="Remove {addon.name}?"
		description={addon.libraries
			? `Its ${addon.libraries} ${addon.libraries === 1 ? 'library is' : 'libraries are'} removed too.`
			: 'Apps stop using its catalogs, metadata and streams.'}
		confirmLabel={addon.libraries
			? `Remove addon and ${addon.libraries} ${addon.libraries === 1 ? 'library' : 'libraries'}`
			: 'Remove addon'}
		onConfirm={() => removeForm?.requestSubmit()}
	/>
</li>
