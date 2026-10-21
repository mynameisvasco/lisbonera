# Lisbonera — design

Date: 2026-10-21
Status: approved in conversation

## Goal

An open-source, single-owner alternative to jlly.cc: a Jellyfin-compatible server that runs entirely on the
Cloudflare Workers **free plan**. Content comes from Stremio addons (catalogs, metadata, streams). Any Jellyfin
client (Infuse, Swiftfin, Findroid, Jellyfin Web, Jellyfin Android TV) can log in, browse, search and play.

Non-goals: public registration, multi-tenant hosting, transcoding, proxying video, built-in debrid, Live TV,
music, `channel`/`tv` Stremio types.

## Constraints (verified 2026-10-21)

- Workers free plan: 10 ms CPU per request, **50 subrequests per request (Cache API calls count)**, 6 concurrent
  outbound connections, 100k requests/day.
- D1 free plan: 100k rows written/day.
- SvelteKit 3.x removed `csrf.checkOrigin`; the origin check runs before `handle` and rejects mutating requests
  with no `Content-Type` (or a form type) and no matching `Origin`. Native Jellyfin clients send exactly that.
- Jellyfin Kotlin SDK parses `Id` as UUID: every item id must be a 32-char lowercase hex GUID.
- Trakt requires VIP to create API apps (Aug 2026) and free accounts may connect only one community app.

## Stack

SvelteKit 3 + Svelte 5 (runes), TypeScript strict, `@sveltejs/adapter-cloudflare` targeting Workers, Wrangler 4,
D1, Cache API. Dashboard: shadcn-svelte, Tailwind v4, Phosphor icons (`phosphor-svelte`, no Lucide), Geist and
Geist Mono via `@fontsource-variable`, superforms + formsnap + zod. Tests: Vitest +
`@cloudflare/vitest-pool-workers`. Jellyfin DTO types imported type-only from `@jellyfin/sdk`.

## Architecture

```
request ─► src/hooks.server.ts (handle)
            ├─ Jellyfin API path ─► src/lib/server/jellyfin/router.ts ─► handlers
            └─ everything else   ─► SvelteKit generated worker (dashboard at /admin, assets)
```

The `handle` hook answers Jellyfin API paths itself and passes everything else to SvelteKit. SvelteKit's CSRF
check is disabled with `csrf.trustedOrigins: ['*']` and re-applied in the hook to all non-API requests.

A path belongs to the Jellyfin API unless it starts with `/admin`, `/_app` or is a static asset. Matching is
case-insensitive and an optional `/emby` or `/jellyfin` prefix is stripped. Query parameter names are read
case-insensitively (Infuse sends camelCase).

### Modules (`src/lib/server/`)

| Module           | Responsibility                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- |
| `env.ts`         | Typed bindings/secrets                                                              |
| `db.ts`          | Typed D1 queries                                                                    |
| `crypto.ts`      | PBKDF2 hashing, random tokens, AES-GCM encryption, SHA-based GUIDs                  |
| `auth/access.ts` | Validate `Cf-Access-Jwt-Assertion` (JWKS, `aud`, `iss`, allowed email) for `/admin` |
| `auth/client.ts` | App passwords, Jellyfin session tokens, token extraction from request               |
| `stremio/`       | Addon client (manifest/catalog/meta/stream), timeouts, cache, subrequest budget     |
| `ids.ts`         | Stremio id ⇄ GUID, synthetic season/episode ids, batched `id_map` writes            |
| `jellyfin/`      | Router, handlers, DTO mapping                                                       |
| `images.ts`      | Image proxy with edge cache                                                         |
| `scrobble/`      | Generic `ScrobbleProvider` interface, registry, Trakt implementation                |

## Authentication

- `/admin/*` is protected by a Cloudflare Access application. The worker also verifies the Access JWT and the
  `ADMIN_EMAIL`. Local dev bypass only when running under `vite dev`.
- Jellyfin clients log in with `POST /Users/AuthenticateByName` using the owner username (`JELLYFIN_USERNAME`,
  default `admin`) and an **app password** created in the dashboard. App passwords are stored as PBKDF2 hashes.
  Login returns a random session token stored as a SHA-256 hash in `sessions`. Revoking an app password deletes its
  sessions.
- Token sources: `Authorization: MediaBrowser … Token="…"`, `X-Emby-Authorization`, `X-Emby-Token`,
  `X-MediaBrowser-Token`, `api_key`/`ApiKey` query.
- Login attempts are rate limited per IP.

## Jellyfin API (v1)

| Group     | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System    | `GET /System/Info/Public`, `GET /System/Info`, `GET/POST /System/Ping`, `GET /Branding/Configuration`, `GET /Branding/Css`, `GET /QuickConnect/Enabled`, `GET /Users/Public`, `GET /System/Endpoint`                                                                                                                                                                                                                                                                                                                                              |
| User      | `GET /Users/Me`, `GET /Users/{id}`, `GET /Users`, `GET/POST /DisplayPreferences/{id}`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Libraries | `GET /UserViews`, `GET /Users/{id}/Views`, `GET /Library/MediaFolders`, `GET /Library/VirtualFolders`, `GET /Users/{id}/GroupingOptions`                                                                                                                                                                                                                                                                                                                                                                                                          |
| Items     | `GET /Items`, `GET /Users/{id}/Items`, `GET /Items/{id}`, `GET /Users/{id}/Items/{id}`, `GET /Items/Latest`, `GET /Users/{id}/Items/Latest`, `GET /Items/Resume`, `GET /Users/{id}/Items/Resume`, `GET /Shows/NextUp`, `GET /Shows/{id}/Seasons`, `GET /Shows/{id}/Episodes`, `GET /Search/Hints`, `GET /Items/Counts`; empty but valid: `/Items/{id}/Similar`, `/Items/Filters`, `/Items/Filters2`, `/Genres`, `/Items/{id}/LocalTrailers`, `/Items/{id}/SpecialFeatures`, `/Items/{id}/ThemeMedia`, `/Items/{id}/Intros`, `/MediaSegments/{id}` |
| Images    | `GET/HEAD /Items/{id}/Images/{type}[/{index}]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Playback  | `GET/POST /Items/{id}/PlaybackInfo`, `GET/HEAD /Videos/{id}/stream[.{ext}]`, `GET /Items/{id}/Download` → 302                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Sessions  | `POST /Sessions/Capabilities[/Full]`, `POST /Sessions/Playing`, `/Playing/Progress`, `/Playing/Stopped`, `/Playing/Ping`, `POST/DELETE /Users/{id}/PlayedItems/{id}`, `POST/DELETE /UserPlayedItems/{id}`, `POST /Sessions/Logout`                                                                                                                                                                                                                                                                                                                |

Unknown paths return 404 and are logged.

### Mapping

- `movie` → `Movie`, `series` → `Series`; seasons and episodes synthesized from `meta.videos`.
- Stremio ids: movie/series `tt…` (or addon-specific), season `${series}:${season}`, episode
  `${series}:${season}:${episode}`. Jellyfin ids: `guid(stremioId)` = first 16 bytes of SHA-256, hex.
  Reverse map stored in `id_map`, written with `INSERT OR IGNORE` in one batch per response.
- Libraries are `CollectionFolder`s with `CollectionType` `movies`/`tvshows` (catalog) or `boxsets`-like
  `movies`/`tvshows`/`mixed` for manual collections. Library ids are random GUIDs stored in `libraries`.
- `Item.Path` is a readable name (never a URL or `stream`). `LocationType` is `Remote`. `ServerId` is constant.
- `UserData` is filled from the active scrobble provider's watch snapshot (5 min cache) when present.

### Pagination

Stremio catalogs page with `skip`. For `StartIndex`/`Limit`, fetch pages until `StartIndex + Limit + 1` items
are known or the catalog ends (a page shorter than the previous one, or empty). `TotalRecordCount` is exact on the
last page and `StartIndex + returned + 1` otherwise.

### Playback

- Browsing never resolves streams.
- `PlaybackInfo` and item detail for a playable item (movie/episode) query all enabled stream addons in parallel
  (8 s timeout), drop entries without an `http(s)` `url`, entries with `behaviorHints.proxyHeaders`, and
  duplicates. Each becomes a `MediaSourceInfo` with `SupportsDirectPlay: true`, `SupportsDirectStream: true`,
  `SupportsTranscoding: false`, `Protocol: Http`, `IsRemote: true`, `Name` from the addon title.
- `MediaSource.Id` = `guid(addonId + stream identity)`, stable across URL refreshes. The resolved source list is
  cached for 2 h in the Cache API keyed by item; on miss the stream route re-resolves.
- `/Videos/{id}/stream` and `/Items/{id}/Download` → 302 to the URL of `MediaSourceId` (or the first source).
- No playable source → `MediaSources: []`, `ErrorCode: "NoCompatibleStream"`.

### Search

`SearchTerm` and `/Search/Hints` query catalogs that declare a `search` extra, merged and de-duplicated by id.

### Images

`/Items/{id}/Images/Primary|Backdrop|Logo|Thumb` resolve the meta's `poster`/`background`/`logo`, fetch it, and
store it in the edge cache for 7 days (`Cache-Control: public, max-age=604800, immutable`). Image tags are a hash
of the source URL so clients cache correctly.

## Caching and budgets

- Manifests: 6 h. Catalog pages: 30 min. Metas: 6 h. Stale entries served on upstream error (stored with a
  timestamp; fresh TTL checked in code, Cache API TTL 7 days).
- Every request has a subrequest budget of 45 (fetch + cache operations). When exhausted, remaining addon calls are
  skipped and partial results are returned.
- Long series metas are cached already converted to compact episode lists.

## Scrobbling

```ts
interface ScrobbleProvider {
	readonly id: string;
	readonly name: string;
	startDeviceAuth(): Promise<DeviceCode>;
	pollDeviceAuth(deviceCode: string): Promise<ProviderTokens | 'pending'>;
	scrobble(event: 'start' | 'pause' | 'stop', item: MediaRef, progress: number): Promise<void>;
	setWatched(item: MediaRef, watched: boolean): Promise<void>;
	resume(): Promise<ResumeEntry[]>;
	nextUp(): Promise<MediaRef[]>;
	watchSnapshot(): Promise<WatchSnapshot>;
}
```

- `MediaRef = { type: 'movie' | 'episode' | 'show', imdb?, tmdb?, season?, episode? }`. Items without IMDb/TMDB ids
  are skipped.
- One active provider. Trakt is the first implementation. Tokens encrypted with AES-GCM (`ENCRYPTION_KEY`).
- Scrobble calls run in `ctx.waitUntil`; on 401 refresh once. Progress events throttled to one per item per 5 min.
- Dashboard shows a warning about Trakt VIP and the one-app limit.

## Data model (D1)

`settings`, `addons`, `libraries`, `collection_items`, `app_passwords`, `sessions`, `id_map`, `scrobble_accounts`,
`display_prefs`, `login_attempts`. SQL migrations in `migrations/`, applied with `wrangler d1 migrations apply`.

## Dashboard

Pages: Connection, Addons, Libraries (catalog toggles, rename, order; manual collections with search, add,
reorder), Devices (app passwords shown once, revoke, sessions), Scrobbling (provider, device-code connect, status,
Trakt warning). shadcn-svelte neutral theme, Geist, Phosphor icons only where they carry function, light/dark,
sidebar layout, dense tables. No decorative illustrations, emoji, gradients, sparkle icons, marketing copy or
assistant widgets.

## Errors

See table in conversation; summarized: per-addon timeouts and stale-on-error, partial results on budget
exhaustion, 401 on bad tokens, 404 + log on unknown, `NoCompatibleStream`, scrobble never blocks playback,
generic JSON 500 without stack, Workers Logs enabled.

## Testing

Unit (ids, mapping, pagination, query normalization, crypto, Trakt with mocked fetch), integration on
`@cloudflare/vitest-pool-workers` with real D1 and a fake addon (login, browse, PlaybackInfo, 302, scrobble, and a
regression test that `POST` without `Origin`/`Content-Type` succeeds), `svelte-check`, ESLint, Prettier, GitHub
Actions. Manual client checklist in `docs/clients.md`.

## Deploy

Deploy-to-Cloudflare button plus `pnpm setup && pnpm deploy`. README documents Access setup and secrets
(`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAIL`, `ENCRYPTION_KEY`, optional `TRAKT_CLIENT_ID`,
`TRAKT_CLIENT_SECRET`).

## Changes during implementation

- App passwords are random (~119 bits) and stored as SHA-256, not PBKDF2: PBKDF2 at 100k iterations exceeds the
  free plan's 10 ms CPU budget, and a random secret does not need key stretching.
- The Jellyfin API runs in SvelteKit's `handle` hook, which returns its response without resolving a route.
  SvelteKit's built-in CSRF check is turned off with `csrf.trustedOrigins: ['*']` (the supported replacement for
  `checkOrigin: false`) and the same rule is applied to all non-API requests in the hook.
- Dashboard server code reads bindings from `cloudflare:workers` (adapter-cloudflare 8 no longer fills
  `platform` in dev).
- Trakt client credentials are entered in the dashboard and stored encrypted in D1 instead of being secrets, so
  connecting a provider needs no redeploy. Required secrets: `ENCRYPTION_KEY`, `ACCESS_TEAM_DOMAIN`,
  `ACCESS_AUD`, `ADMIN_EMAIL`.
- Libraries are capped at 500 titles.
- The scrobble provider interface reads `playback`, `watchedMovies`, `showProgress` and `recentShows` separately
  instead of one large snapshot, to keep JSON parsing inside the CPU budget.
