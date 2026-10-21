<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import Logo from '#lib/components/brand/logo.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import HouseIcon from 'phosphor-svelte/lib/House';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';
	import DevicesIcon from 'phosphor-svelte/lib/Devices';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwise';
	import UserCircleIcon from 'phosphor-svelte/lib/UserCircle';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const nav = [
		{ href: resolve('/admin'), label: 'Overview', icon: HouseIcon, exact: true },
		{ href: resolve('/admin/libraries'), label: 'Libraries', icon: StackIcon },
		{ href: resolve('/admin/addons'), label: 'Addons', icon: PuzzlePieceIcon },
		{ href: resolve('/admin/devices'), label: 'Devices', icon: DevicesIcon },
		{ href: resolve('/admin/scrobbling'), label: 'Trakt', icon: ClockCounterClockwiseIcon }
	];

	function active(href: string, exact = false) {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}
</script>

<div class="min-h-svh pb-20 md:pb-0">
	<header class="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
			<a href={resolve('/admin')} class="shrink-0 rounded-md" aria-label="Lisbonera overview">
				<Logo />
			</a>

			<nav class="hidden h-full items-stretch gap-6 md:flex" aria-label="Sections">
				{#each nav as item (item.href)}
					{@const current = active(item.href, item.exact)}
					<a
						href={item.href}
						aria-current={current ? 'page' : undefined}
						class={[
							'-mb-px flex items-center border-b-2 text-sm transition-colors',
							current
								? 'border-primary text-foreground'
								: 'border-transparent text-muted-foreground hover:text-foreground'
						]}
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="ml-auto">
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon" class="ml-auto" aria-label="Account">
							<UserCircleIcon class="size-5" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-56">
					<DropdownMenu.Label class="truncate font-normal text-muted-foreground">
						{data.email}
					</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.RadioGroup
						value={userPrefersMode.current}
						onValueChange={(value) => setMode(value as 'light' | 'dark' | 'system')}
					>
						<DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href="/cdn-cgi/access/logout" rel="external" {...props}>Sign out</a>
						{/snippet}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</header>

	<main class="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6">
		{@render children()}
	</main>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
		aria-label="Sections"
	>
		{#each nav as item (item.href)}
			{@const current = active(item.href, item.exact)}
			<a
				href={item.href}
				aria-current={current ? 'page' : undefined}
				class={[
					'flex h-14 flex-col items-center justify-center gap-1 text-[11px]',
					current ? 'text-foreground' : 'text-muted-foreground'
				]}
			>
				<item.icon class="size-5" weight={current ? 'fill' : 'regular'} />
				{item.label}
			</a>
		{/each}
	</nav>
</div>
