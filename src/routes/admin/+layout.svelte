<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import PlugsConnectedIcon from 'phosphor-svelte/lib/PlugsConnected';
	import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import DevicesIcon from 'phosphor-svelte/lib/Devices';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwise';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const nav = [
		{ href: resolve('/admin'), label: 'Connection', icon: PlugsConnectedIcon, exact: true },
		{ href: resolve('/admin/addons'), label: 'Addons', icon: PuzzlePieceIcon },
		{ href: resolve('/admin/libraries'), label: 'Libraries', icon: StackIcon },
		{ href: resolve('/admin/devices'), label: 'Devices', icon: DevicesIcon },
		{ href: resolve('/admin/scrobbling'), label: 'Scrobbling', icon: ClockCounterClockwiseIcon }
	];

	function active(href: string, exact = false) {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}
</script>

<Sidebar.Provider>
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header>
			<div
				class="flex h-8 items-center px-2 text-sm font-semibold group-data-[collapsible=icon]:hidden"
			>
				Lisbonera
			</div>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.Menu>
					{#each nav as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={active(item.href, item.exact)}
								tooltipContent={item.label}
							>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer>
			<p class="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
				{data.email}
			</p>
		</Sidebar.Footer>
	</Sidebar.Root>
	<Sidebar.Inset>
		<header class="flex h-12 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ml-1" />
		</header>
		<main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
