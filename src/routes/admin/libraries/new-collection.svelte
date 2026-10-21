<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import type { z } from 'zod';
	import SubmitButton from '#lib/components/submit-button.svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { TYPE_LABEL } from '#lib/format.js';
	import {
		collectionSchema,
		genreCollectionsSchema,
		listSchema,
		mdblistKeySchema
	} from '#lib/schemas.js';
	import FilmSlateIcon from 'phosphor-svelte/lib/FilmSlate';
	import TelevisionSimpleIcon from 'phosphor-svelte/lib/TelevisionSimple';
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';

	interface GenreCatalog {
		key: string;
		addonName: string;
		type: 'movie' | 'series';
		name: string;
		genres: string[];
	}

	let {
		open = $bindable(false),
		createForm,
		genresForm,
		listForm,
		keyForm,
		genreCatalogs,
		hasMdblistKey,
		hasTraktApp
	}: {
		open?: boolean;
		createForm: SuperValidated<z.infer<typeof collectionSchema>>;
		genresForm: SuperValidated<z.infer<typeof genreCollectionsSchema>>;
		listForm: SuperValidated<z.infer<typeof listSchema>>;
		keyForm: SuperValidated<z.infer<typeof mdblistKeySchema>>;
		genreCatalogs: GenreCatalog[];
		hasMdblistKey: boolean;
		hasTraktApp: boolean;
	} = $props();

	let tab = $state('manual');
	let editingKey = $state(false);

	// superForm keeps itself in sync with action results; it only needs the initial value.
	const create = superForm(
		untrack(() => createForm),
		{ validators: zod4Client(collectionSchema) }
	);
	const { form: createData, enhance: createEnhance, submitting: creating } = create;

	const genres = superForm(
		untrack(() => genresForm),
		{
			validators: zod4Client(genreCollectionsSchema),
			onUpdated: ({ form }) => {
				if (!form.valid || !form.message) return;
				toast.success(form.message);
				open = false;
			}
		}
	);
	const { form: genresData, enhance: genresEnhance, submitting: creatingGenres } = genres;

	const list = superForm(
		untrack(() => listForm),
		{ validators: zod4Client(listSchema) }
	);
	const { form: listData, enhance: listEnhance, submitting: creatingList } = list;

	const key = superForm(
		untrack(() => keyForm),
		{
			validators: zod4Client(mdblistKeySchema),
			onUpdated: ({ form }) => {
				if (form.valid && form.message) {
					toast.success(form.message);
					editingKey = false;
				}
			}
		}
	);
	const { form: keyData, enhance: keyEnhance, submitting: savingKey } = key;

	const catalog = $derived(genreCatalogs.find((item) => item.key === $genresData.catalog));
	const isTrakt = $derived(/trakt\.tv/i.test($listData.list));

	const types = [
		{ value: 'movie', label: 'Movies', icon: FilmSlateIcon },
		{ value: 'series', label: 'Series', icon: TelevisionSimpleIcon },
		{ value: 'mixed', label: 'Both', icon: SquaresFourIcon }
	] as const;
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>New collection</Dialog.Title>
			<Dialog.Description
				>Collections show up in Jellyfin apps as their own library.</Dialog.Description
			>
		</Dialog.Header>

		<Tabs.Root bind:value={tab} class="gap-5">
			<Tabs.List class="w-full">
				<Tabs.Trigger value="manual">Hand-picked</Tabs.Trigger>
				<Tabs.Trigger value="genres">Genres</Tabs.Trigger>
				<Tabs.Trigger value="list">List</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="manual">
				<form method="POST" action="?/create" use:createEnhance class="space-y-5">
					<Form.Field form={create} name="name">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Name</Form.Label>
								<Input {...props} bind:value={$createData.name} placeholder="Weekend picks" />
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
					<Form.Fieldset form={create} name="type">
						<Form.Legend class="mb-2 text-sm font-medium">Contains</Form.Legend>
						<input type="hidden" name="type" value={$createData.type} />
						<ToggleGroup.Root
							type="single"
							variant="outline"
							class="w-full"
							value={$createData.type}
							onValueChange={(value) =>
								value && ($createData.type = value as typeof $createData.type)}
						>
							{#each types as type (type.value)}
								<ToggleGroup.Item value={type.value} class="flex-1 gap-1.5">
									<type.icon />
									{type.label}
								</ToggleGroup.Item>
							{/each}
						</ToggleGroup.Root>
					</Form.Fieldset>
					<Dialog.Footer>
						<SubmitButton pending={$creating}>Create and add titles</SubmitButton>
					</Dialog.Footer>
				</form>
			</Tabs.Content>

			<Tabs.Content value="genres">
				{#if genreCatalogs.length === 0}
					<p class="text-sm text-muted-foreground">
						None of your addons lists genres for its catalogs. Cinemeta and AIOMetadata do.
					</p>
				{:else}
					<form method="POST" action="?/genres" use:genresEnhance class="space-y-5">
						<Form.Field form={genres} name="catalog">
							<Form.Control>
								{#snippet children({ props })}
									<Form.Label>Catalog</Form.Label>
									<Select.Root
										type="single"
										name={props.name}
										bind:value={$genresData.catalog}
										onValueChange={() => ($genresData.genres = [])}
									>
										<Select.Trigger {...props} class="w-full">
											{catalog
												? `${catalog.addonName} · ${catalog.name} (${TYPE_LABEL[catalog.type]})`
												: 'Choose a catalog'}
										</Select.Trigger>
										<Select.Content>
											{#each genreCatalogs as item (item.key)}
												<Select.Item value={item.key}>
													{item.addonName} · {item.name}
													<span class="text-muted-foreground">{TYPE_LABEL[item.type]}</span>
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								{/snippet}
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>

						{#if catalog}
							<Form.Fieldset form={genres} name="genres">
								<div class="mb-2 flex items-center justify-between">
									<Form.Legend class="text-sm font-medium">Genres</Form.Legend>
									<Button
										variant="link"
										size="xs"
										class="px-0"
										onclick={() =>
											($genresData.genres =
												$genresData.genres.length === catalog.genres.length
													? []
													: [...catalog.genres])}
									>
										{$genresData.genres.length === catalog.genres.length ? 'None' : 'All'}
									</Button>
								</div>
								{#each $genresData.genres as genre (genre)}
									<input type="hidden" name="genres" value={genre} />
								{/each}
								<ToggleGroup.Root
									type="multiple"
									variant="outline"
									size="sm"
									spacing={1}
									class="flex max-h-56 flex-wrap justify-start overflow-y-auto"
									bind:value={$genresData.genres}
								>
									{#each catalog.genres as genre (genre)}
										<ToggleGroup.Item value={genre}>{genre}</ToggleGroup.Item>
									{/each}
								</ToggleGroup.Root>
								<Form.FieldErrors />
							</Form.Fieldset>
						{/if}
						<p class="text-xs text-muted-foreground">
							One collection per genre. Give them artwork from a
							<a
								href={resolve('/admin/libraries/packs')}
								class="text-primary underline-offset-4 hover:underline">pack</a
							>.
						</p>
						<Dialog.Footer>
							<SubmitButton pending={$creatingGenres} disabled={!$genresData.genres.length}>
								Create {$genresData.genres.length || ''}
								{$genresData.genres.length === 1 ? 'collection' : 'collections'}
							</SubmitButton>
						</Dialog.Footer>
					</form>
				{/if}
			</Tabs.Content>

			<Tabs.Content value="list" class="space-y-5">
				<form method="POST" action="?/list" use:listEnhance class="space-y-5">
					<Form.Field form={list} name="list">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>List URL</Form.Label>
								<Input
									{...props}
									bind:value={$listData.list}
									placeholder="mdblist.com/lists/… or trakt.tv/users/…"
									autocomplete="off"
									class="font-mono text-sm"
								/>
							{/snippet}
						</Form.Control>
						<Form.Description class="text-xs">
							The collection follows the list, so it updates when the list does.
						</Form.Description>
						<Form.FieldErrors />
					</Form.Field>
					<Form.Field form={list} name="name">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Name <span class="text-muted-foreground">(optional)</span></Form.Label>
								<Input {...props} bind:value={$listData.name} placeholder="The list’s own name" />
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
					<Dialog.Footer>
						<SubmitButton pending={$creatingList} disabled={isTrakt ? !hasTraktApp : !hasMdblistKey}
							>Create collection</SubmitButton
						>
					</Dialog.Footer>
				</form>

				<div class="space-y-2 border-t pt-4 text-xs text-muted-foreground">
					<p>
						Trakt lists use your Trakt API app
						{#if hasTraktApp}
							(set up).
						{:else}
							— <a
								href={resolve('/admin/scrobbling')}
								class="text-primary underline-offset-4 hover:underline">add one under Scrobbling</a
							>.
						{/if}
					</p>
					{#if hasMdblistKey && !editingKey}
						<div class="flex items-center gap-2">
							<p>MDBList API key saved.</p>
							<Button variant="link" size="xs" class="px-0" onclick={() => (editingKey = true)}
								>Change</Button
							>
							<form method="POST" action="?/forgetKey" use:enhance>
								<Button type="submit" variant="link" size="xs" class="px-0 text-destructive"
									>Remove</Button
								>
							</form>
						</div>
					{:else}
						<form method="POST" action="?/key" use:keyEnhance class="space-y-2">
							<Form.Field form={key} name="key">
								<Form.Control>
									{#snippet children({ props })}
										<Form.Label class="block text-xs font-normal text-muted-foreground">
											<span
												>MDBList lists need a free API key from
												<a
													href="https://mdblist.com/preferences/"
													target="_blank"
													rel="external noreferrer"
													class="text-primary underline-offset-4 hover:underline"
													>mdblist.com/preferences</a
												>.</span
											>
										</Form.Label>
										<div class="flex gap-2">
											<Input
												{...props}
												type="password"
												bind:value={$keyData.key}
												autocomplete="off"
												class="font-mono text-sm"
												placeholder="API key"
											/>
											<SubmitButton pending={$savingKey} variant="secondary">Save</SubmitButton>
										</div>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors />
							</Form.Field>
						</form>
					{/if}
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</Dialog.Content>
</Dialog.Root>
