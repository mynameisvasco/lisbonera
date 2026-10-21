<script lang="ts">
	import { enhance } from '$app/forms';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import { toast } from 'svelte-sonner';
	import ToggleForm from '#lib/components/toggle-form.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { reportFailure } from '#lib/forms.js';
	import { timeAgo } from '#lib/format.js';
	import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwise';
	import CopyIcon from 'phosphor-svelte/lib/Copy';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVertical';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThree';
	import InfoIcon from 'phosphor-svelte/lib/Info';
	import PlayIcon from 'phosphor-svelte/lib/Play';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';

	interface Addon {
		id: string;
		url: string;
		host: string;
		name: string;
		version: string | null;
		description: string | null;
		logo: string | null;
		catalogs: number;
		resources: string[];
		enabled: boolean;
		lastError: string | null;
		checkedAt: number | null;
	}

	let { addon, index }: { addon: Addon; index: number } = $props();

	const sortable = createSortable({
		get id() {
			return addon.id;
		},
		get index() {
			return index;
		}
	});

	let logoFailed = $state(false);
	let refreshForm = $state<HTMLFormElement>();
	let removeForm = $state<HTMLFormElement>();

	const streams = $derived(addon.resources.includes('stream'));
	const meta = $derived(addon.resources.includes('meta'));
</script>

<article
	{@attach sortable.attach}
	class={[
		'flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-3 pr-4 transition-shadow sm:items-center sm:gap-4',
		sortable.isDragging && 'z-20 shadow-2xl ring-2 ring-primary/50',
		!addon.enabled && 'opacity-60'
	]}
>
	<button
		{@attach sortable.attachHandle}
		class="flex size-8 shrink-0 cursor-grab items-center justify-center self-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
		aria-label="Drag to change the priority of {addon.name}"
	>
		<DotsSixVerticalIcon class="size-4" weight="bold" />
	</button>

	<div
		class="hidden size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:flex"
	>
		{#if addon.logo && !logoFailed}
			<img
				src={addon.logo}
				alt=""
				class="size-full object-contain p-1.5"
				onerror={() => (logoFailed = true)}
			/>
		{:else}
			<span class="text-lg font-semibold text-muted-foreground"
				>{addon.name.slice(0, 1).toUpperCase()}</span
			>
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex items-baseline gap-2">
			<h3 class="truncate font-medium">{addon.name}</h3>
			{#if addon.version}<span class="font-mono text-[11px] text-muted-foreground"
					>v{addon.version}</span
				>{/if}
		</div>
		<p class="truncate text-sm text-muted-foreground" title={addon.description ?? addon.url}>
			{addon.description ?? addon.host}
		</p>
		<div class="mt-2 flex flex-wrap gap-1.5 text-xs">
			{#if streams}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-tram/15 px-2 py-0.5 font-medium text-amber-700 dark:text-tram"
				>
					<PlayIcon weight="fill" class="size-3" /> Streams
				</span>
			{/if}
			{#if addon.catalogs > 0}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
				>
					<StackIcon class="size-3" />
					{addon.catalogs}
					{addon.catalogs === 1 ? 'catalog' : 'catalogs'}
				</span>
			{/if}
			{#if meta}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
				>
					<InfoIcon class="size-3" /> Metadata
				</span>
			{/if}
		</div>
		{#if addon.lastError}
			<p class="mt-2 flex items-start gap-1.5 text-xs text-terracotta">
				<WarningCircleIcon class="mt-px size-3.5 shrink-0" />
				<span class="min-w-0 break-words">{addon.lastError} · {timeAgo(addon.checkedAt)}</span>
			</p>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-1 self-center">
		<ToggleForm
			action="?/toggle"
			id={addon.id}
			checked={addon.enabled}
			label="Enable {addon.name}"
		/>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon-sm" aria-label="More for {addon.name}">
						<DotsThreeIcon weight="bold" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onSelect={() => refreshForm?.requestSubmit()}>
					<ArrowClockwiseIcon /> Reload manifest
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onSelect={async () => {
						await navigator.clipboard.writeText(`${addon.url}/manifest.json`);
						toast.success('Manifest URL copied');
					}}
				>
					<CopyIcon /> Copy manifest URL
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					variant="destructive"
					onSelect={() => {
						if (confirm(`Remove ${addon.name}? Its catalog libraries are removed too.`))
							removeForm?.requestSubmit();
					}}
				>
					<TrashIcon /> Remove
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

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
</article>
