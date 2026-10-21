<p><img src="static/icon.svg" width="64" height="64" alt=""></p>

# Lisbonera

A personal Jellyfin server that runs on the Cloudflare Workers free plan. Its catalogs, metadata and streams come
from Stremio addons, so Infuse, Swiftfin, Findroid, Jellyfin Web and other Jellyfin clients can browse and play
without a home server, a disk or transcoding.

It is meant for one owner. There is no public sign-up: the dashboard sits behind Cloudflare Access and Jellyfin
clients sign in with app passwords you create there.

## How it works

```
Jellyfin client ──► Worker (SvelteKit, src/hooks.server.ts)
                     ├─ Jellyfin API ──► Stremio addons (catalog, meta, stream)
                     │                   └─ playback: 302 redirect to the stream URL
                     └─ /admin ────────► SvelteKit dashboard (Cloudflare Access)
```

- Each enabled addon catalog becomes a Jellyfin library. Collections add more: hand-picked titles, one per genre
  of an addon catalog (Cinemeta, AIOMetadata…), or an MDBList or Trakt list that they follow as it changes.
- Any library can have its own artwork: an upload, an image URL, or a
  [Fusion Starter Kit](https://kit.betterer.cc/) pack. A pack creates a set of collections (genres, streaming
  services, decades, awards, directors) with their artwork and Trakt lists, or restyles libraries with the same name.
- Video never passes through the Worker. Clients are redirected to the addon's URL and play it directly, so only
  sources that are plain `http(s)` links work. Use addons configured with your debrid service, or addons that
  return direct links.
- Watch progress, watched state, Continue Watching and Next Up come from a scrobbling provider (Trakt for now).
  Without one, nothing is tracked.
- Configuration lives in D1. Addon responses, stream lists and images are cached at the edge.

## Requirements

- A Cloudflare account on the free plan.
- A domain on Cloudflare is recommended. The Worker also runs on `workers.dev`, but the edge cache is only
  guaranteed on custom domains.
- Cloudflare Zero Trust (free for up to 50 users) for the dashboard.

## Deploy

### With the button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lisbonera/lisbonera)

Point the button at your fork. It creates the Worker and the D1 database; the deploy command applies the
migrations. Then set the secrets and Access as described below.

### By hand

```bash
pnpm install
```

```bash
pnpm wrangler login
```

```bash
pnpm run deploy
```

The first deploy creates the `lisbonera` D1 database and applies `migrations/`.

### Secrets

| Name                 | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY`     | A long random string. Encrypts scrobbling tokens and credentials in D1. Do not change it later. |
| `ACCESS_TEAM_DOMAIN` | Your Zero Trust team domain, e.g. `yourteam.cloudflareaccess.com`                               |
| `ACCESS_AUD`         | The Application Audience (AUD) tag of the Access application                                    |
| `ADMIN_EMAIL`        | The email allowed into the dashboard (comma-separated for several)                              |

```bash
pnpm wrangler secret put ENCRYPTION_KEY
```

Repeat for each secret. `JELLYFIN_USERNAME` (default `admin`) is a plain variable in `wrangler.jsonc`.

### Cloudflare Access

1. In Zero Trust, go to **Access → Applications → Add an application → Self-hosted**.
2. Add your domain with the path `admin` (this covers `/admin/*`). Do not protect the whole domain: Jellyfin clients
   cannot pass an Access login page, and Workers behind Access lose the Cache API.
3. Add a policy that allows your email.
4. Copy the **Application Audience (AUD) tag** into `ACCESS_AUD`.

The Worker verifies the Access token itself as well, so requests that bypass Access (for example through the
`workers.dev` URL) are refused.

## First run

1. Open `https://your-domain/admin`. Cinemeta is installed and its catalogs are enabled as libraries.
2. **Addons**: add the manifest URLs of your stream addons, already configured with your debrid key if they need one.
3. **Devices**: create an app password for each device. It is shown once; dashes and case are ignored.
4. In your Jellyfin client, add a server with your domain, the username (`admin` unless changed) and the app
   password.

## Lists and artwork

- **Trakt lists** (and the Trakt-sourced packs) are read with the Trakt API app you set up for scrobbling.
- **MDBList lists** need a free API key from [mdblist.com/preferences](https://mdblist.com/preferences/), saved in
  the New collection dialog. It is stored encrypted, like the Trakt tokens.
- Title artwork comes from the addons (Cinemeta serves `images.metahub.space`); list items use the same service by
  IMDb id. For TMDB/TVDB/Fanart artwork and richer catalogs, install
  [AIOMetadata](https://github.com/cedya77/aiometadata) above Cinemeta.

## Scrobbling

Trakt is the first provider. You need your own Trakt API application with the redirect URI
`urn:ietf:wg:oauth:2.0:oob`. **Since August 2026 Trakt requires VIP to create API applications, and free accounts
can connect only one third-party app.** The dashboard shows this before you connect.

Providers implement `ScrobbleProvider` in `src/lib/server/scrobble/types.ts` and are registered in
`src/lib/server/scrobble/service.ts`. Only one provider is active at a time.

## Limits

The free plan allows 100,000 requests a day, 10 ms of CPU and 50 outbound requests per request. To stay inside them:

- Libraries expose at most 500 titles, so clients that sync whole libraries stay bounded.
- Each request has a budget of 45 outbound calls; when it runs out the response contains what was gathered.
- Streams are only looked up when a movie or episode is opened, never while browsing.
- Progress reports from clients are forwarded to the provider at most every five minutes per item.

## Development

```bash
pnpm dev
```

Runs the dashboard with Vite; the Access check is skipped in dev. Copy `.dev.vars.example` to `.dev.vars` first and
run `pnpm db:migrate` once.

```bash
pnpm preview
```

Runs the built Worker, including the Jellyfin API, at `http://localhost:4173`.

```bash
pnpm test
```

Runs the tests inside the Workers runtime with a local D1 and a mocked addon. `pnpm check` and `pnpm lint` cover
types and style. `docs/clients.md` is the manual checklist for real clients.

### Layout

| Path                       | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `src/hooks.server.ts`      | Jellyfin API, dashboard CSRF guard, Access check |
| `src/lib/server/jellyfin/` | Router, handlers, DTO mapping, playback          |
| `src/lib/server/stremio/`  | Addon protocol client                            |
| `src/lib/server/scrobble/` | Provider interface and Trakt                     |
| `src/lib/server/auth/`     | App passwords, sessions, Access verification     |
| `src/routes/admin/`        | Dashboard                                        |
| `migrations/`              | D1 schema                                        |

## Disclaimer

Lisbonera does not host or index media. What you can play depends entirely on the addons you configure, and you
are responsible for using them lawfully.

## License

MIT
