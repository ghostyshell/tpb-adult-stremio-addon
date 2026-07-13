# TPB 4K Porn - Stremio Addon

[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/EbHcTNAqca)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/ghosty99)
[![Reddit](https://img.shields.io/badge/r/TPB4KPorn-FF4500?style=for-the-badge&logo=reddit&logoColor=white)](https://www.reddit.com/r/TPB4KPorn/)

A self-hosted Stremio addon for 4K and 1080p adult content with debrid stream resolution and a React/Next.js configure UI.

**Live instance:** [tpb-adult-addon.click/configure](https://tpb-adult-addon.click/configure)
**Docs site:** [ghostyshell.github.io/tpb-adult-stremio-addon](https://ghostyshell.github.io/tpb-adult-stremio-addon/)

---

## Features

- **Adult catalogs** from multiple sources:
  - **ThePirateBay / HiddenBay** - 4K (cat 507) and 1080p (cat 505), Top and Recent
  - **PornRips** - scene release blog with studio/tag/quality browsing
  - **HentaiMama** - episode-level streams via proxy
  - **Sukebei** - JAV torrents cross-referenced with StashDB metadata
  - **TPDB / StashDB categories** - performer/category-browsable catalogs (server key required)
- **Stripchat live cams** - HLS proxy decrypts the site's MOUFLON v2 playlist obfuscation so live cam streams play inside Stremio's internal player. See [Stripchat](#stripchat-live-cams) below.
- **12 debrid providers** for cached stream resolution - Real-Debrid, TorBox, Premiumize, EasyDebrid, Debrid-Link, Offcloud, Put.io, Deepbrid, LinkSnappy, Mega-Debrid, Debrider, Seedr
- **P2P fallback** with magnet links when no debrid key is set or cache miss occurs
- **MediaFlow proxy** support for IP-restricted CDN links
- **Redis caching** for stream resolution, catalog results, and metadata
- **MongoDB** optional persistent torrent store
- **Favorites** - Redis-backed per-instance favorites list with `/api/favorites` REST API
- **Saved profiles** - AES-256-GCM encrypted config slots keyed off the Stremio user email (requires `SESSION_SECRET` + `MONGODB_URI`); see `/api/profile`
- **Multi-instance splitting** - divide catalogs across multiple addon installs to stay under Stremio's manifest size limit
- **Custom name postfix** - label each install (e.g. "RD", "4K only") so they're identifiable in Stremio

---

## Quick Start

### Deploy with Docker

```bash
docker build -t stremio-tpb-porn .
docker run -p 7000:7000 \
  -e BACKEND_URL=https://your-backend.example.com \
  stremio-tpb-porn
```

Open `http://localhost:7000/configure` to generate your personal install URL.

### Environment Variables

The full reference (defaults, precedence, every tuning knob) lives in [`docs/configuration.md`](docs/configuration.md). The most common ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | Listen port (default `7000`) |
| `BACKEND_URL` | yes | Base URL of the [torrent-search-go](https://github.com/ghostyshell/torrent-search-go) backend - required for all catalog and meta endpoints |
| `ADDON_API_TOKEN` | no | Bearer token sent to the backend for auth |
| `TPDB_API_KEY` | no | ThePornDB / metadataapi.net key - enables TPDB category catalogs and metadata enrichment |
| `STASHDB_API_KEY` | no | StashDB API key - enables Sukebei catalog and StashDB category browsing |
| `REFERENCE_ADDON_URL` | no | URL of a reference Hentai addon to proxy catalogs and metadata from |
| `REDIS_URL` | no | Redis connection URL for caching (strongly recommended in production) |
| `REDIS_PASSWORD` | no | Redis auth password |
| `MONGODB_URI` | no | MongoDB URI. When set, the long-lived metadata stores move off Redis into Mongo. See `docs/configuration.md` for the full `MONGO_*` family (`MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_AUTH_SOURCE`, `MONGODB_DB`, `MONGO_COLLECTION`, `MONGO_POOL_SIZE`, `MONGO_TIMEOUT_MS`, `MONGO_SOCKET_TIMEOUT_MS`, `MONGO_HOT`, `MONGO_HOT_MAX`, `MONGO_HOT_TTL_MS`). |
| `SESSION_SECRET` | no | Random 32+ char secret used to derive AES-256-GCM keys for saved user profiles. If unset, a random value is used per process start and all saved profiles are lost on restart. Generate with `openssl rand -hex 32`. |
| `ADMIN_TOKEN` | no | Secret token for the `/admin/flush-cat-cache` endpoint (sent as `X-Admin-Token` header). Leave unset to disable the endpoint. |
| `ALLOW_USER_BACKEND` | no | When set, users can supply their own `backendUrl` in the configure form even when `BACKEND_URL` is set server-side. |
| `TRUST_PROXY_HOPS` | no | Number of reverse proxy hops to trust for `X-Forwarded-For` / `X-Forwarded-Proto` (default `1`, capped at 5). |
| `RATE_LIMIT_WINDOW_MS` | no | Sliding window length (ms) shared by both limiters (default `60000`). |
| `RATE_LIMIT_STREMIO_MAX` | no | Per-IP cap for catalog/meta/stream/manifest (default `300`). |
| `RATE_LIMIT_GLOBAL_MAX` | no | App-wide per-IP flood ceiling (default `600`). |
| `TTL_TORRENT_STORE_S` ... `TTL_SECTION_S` | no | Per-cache Redis TTLs in seconds. See `docs/configuration.md` -> "Redis cache TTLs" for the full list and defaults. |

> **Debrid keys** are per-user - each user enters their key on the configure page and it is encoded into their personal install URL. Keys never touch the server.

---

## Configure and Install

Open `/configure` on your instance:

1. **Tokens** - enter your debrid key and optional TPDB/StashDB tokens
2. **Streams** - configure debrid provider, P2P settings, and MediaFlow proxy
3. **Catalogs** - choose sources, quality tiers, sort variants, and studio/network picks
4. **Display** - set catalog visibility, hide from home screen, multi-instance split, and name postfix
5. Click **Generate Install URLs** then **Install in Stremio**

### Debrid API key sources

| Provider | Key location |
|----------|-------------|
| Real-Debrid | [real-debrid.com/apitoken](https://real-debrid.com/apitoken) |
| TorBox | [torbox.app/settings](https://torbox.app/settings) |
| Premiumize | [premiumize.me/account](https://www.premiumize.me/account) - API section |
| EasyDebrid | [easydebrid.com/settings](https://easydebrid.com/settings) |
| Debrid-Link | [debrid-link.com/webapp/apikey](https://debrid-link.com/webapp/apikey) |
| Offcloud | [offcloud.com/#/account](https://offcloud.com/#/account) |
| Put.io | [put.io/oauth/apps](https://put.io/oauth/apps) |
| Deepbrid | [deepbrid.com/devices](https://www.deepbrid.com/devices) |
| LinkSnappy | [linksnappy.com/myaccount](https://linksnappy.com/myaccount) - enter as `username:password` |
| Mega-Debrid | [mega-debrid.eu](https://www.mega-debrid.eu/index.php?page=api) |
| Debrider | [debrider.app/dashboard/account](https://debrider.app/dashboard/account) |
| Seedr | [seedr.cc](https://www.seedr.cc/account) - enter as a Personal Access Token (`sdp_...`, works on free and premium) or `email:password` (premium only for transfers) |

---

## Architecture

The addon is a **Node.js/TypeScript** app combining **Express** (Stremio protocol endpoints and REST API) with **Next.js** (configure and install UI).

The **[torrent-search-go](https://github.com/ghostyshell/torrent-search-go) backend** handles all scraping, catalog serving, meta, and cover extraction. The Node addon is a thin edge layer responsible for:

- Proxying Stremio manifest/catalog/meta requests to Go via `BACKEND_URL`
- Debrid stream resolution (12 providers, per-user keys)
- Hentai episode streams
- Favorites REST API
- Configure/install UI

```
src/
├── server.ts                 HTTP server entry point
├── createExpressApp.ts       Express app (routes, middleware, Next.js integration)
├── index.ts                  Stremio addon entry (imported by server)
├── manifest.ts               Dynamic manifest builder
├── routes/
│   └── stream.ts             Stream handler - debrid resolution + P2P fallback
├── services/
│   ├── realdebrid.ts         Real-Debrid API client
│   ├── torbox.ts             TorBox API client
│   ├── premiumize.ts         Premiumize API client
│   ├── easydebrid.ts         EasyDebrid API client
│   ├── debridlink.ts         Debrid-Link API client
│   ├── offcloud.ts           Offcloud API client
│   ├── putio.ts              Put.io API client
│   ├── deepbrid.ts           Deepbrid API client
│   ├── linksnappy.ts         LinkSnappy API client
│   ├── megadebrid.ts         Mega-Debrid API client
│   ├── debrider.ts           Debrider API client
│   ├── seedr.ts              Seedr API client
│   ├── hentai.ts             Hentai proxy (catalog filter + episode streams)
│   ├── pornrips.ts           PornRips torrent URL resolver
│   └── backend.ts            Go backend API client (studios KV, auth headers)
├── utils/
│   ├── config.ts             Base64url config encode/decode
│   ├── cache.ts              Redis-backed cache (stream, catalog, meta, section)
│   ├── torrent.ts            Name parsing, ID encoding, quality detection, magnet utils
│   ├── torrentCache.ts       Per-item torrent record store (Redis + MongoDB)
│   ├── adultSections.ts      Catalog definitions (XXX/Trans/studios x Top/Recent)
│   ├── debridProviders.ts    Provider registry (field, tag, label, resolve fns)
│   ├── stremioGo.ts          Go backend proxy helper + fetchGoStreams
│   ├── redis.ts              Redis client wrapper
│   ├── mongo.ts              MongoDB client wrapper
│   └── safeUrl.ts            URL safety checks (blocks private IPs)
├── types/
│   ├── config.ts             AddonConfig interface
│   ├── debrid.ts             DebridProvider, DebridFile, StoredTorrent, etc.
│   ├── stremio.ts            StremioStream interface
│   └── express.d.ts          Express Request augmentation (addonConfig)
├── lib/
│   ├── installBuilder.ts     Install URL and multi-addon generator
│   ├── configureProps.ts     Server-side props for configure page
│   └── configureConstants.ts Debrid provider labels, catalog defaults
└── app/                      Next.js pages
    ├── configure/page.tsx    Configure page
    ├── configure/install/    Install page
    └── globals.css           Global styles
```

---

## Stripchat Live Cams

The addon proxies [Stripchat](https://stripchat.com) live cam streams into Stremio as playable HLS. Stripchat obfuscates its playlists with a MOUFLON v2 scheme (encrypted segment URIs gated behind a rotating `pkey`/`pdkey` pair); the addon decrypts them server-side and serves a plain, web-ready HLS playlist so Stremio's internal `hls.js` player plays the stream inline.

**How it works:**

1. The configure page renders four Stripchat catalogs (`sc_girls`, `sc_couples`, `sc_guys`, `sc_trans`). Each lists currently-live models fetched from the Stripchat broadcasts API.
2. Opening a model calls the standard Stremio `/stream` resource, which returns one stream entry per resolution variant (`1080p`, `720p`, `480p`, `240p`, `Auto`).
3. Each stream URL points at the addon's own `/stripchat/hls/:username/:quality` proxy. The proxy:
   - Fetches the model's master m3u8 from the doppiocdn CDN with the current `pkey` appended.
   - Extracts the `pkey` (PSCH tag) from the master, then resolves the matching `pdkey` from `PD_KEY_*` env vars (see `src/services/stripchatMouflon.ts`).
   - Decrypts `#EXT-X-MOUFLON:URI:` tags into plain segment URLs (`decodeMouflonPlaylist`).
   - Strips Low-Latency HLS tags Stremio's player doesn't understand (`normalizeStripchatM3u8`).
   - Rewrites relative segment URLs to absolute CDN URLs.
4. Segment and sub-playlist fetches go through `/stripchat/seg?url=<encoded>` with an SSRF guard that only allows `edge-hls|media-hls.doppiocdn.*` hosts.

**Why it plays in the Stremio internal player:** the proxy returns standard HLS with direct CDN segment URLs (`behaviorHints: { notWebReady: false }`), the same shape as debrid streams. Stremio hands it to its internal `hls.js` player instead of bouncing to external players. The global CSP middleware also skips `/stripchat/*` paths: CSP and `frame-ancestors` are document headers with no security value on `application/vnd.apple.mpegurl` / `video/MP2T` subresource responses, and setting them on the proxied m3u8 blocked Stremio's player from loading the playlist.

**Files:**

| File | Role |
|------|------|
| `src/services/stripchatHls.ts` | Broadcasts API client, master m3u8 fetch + variant parsing, segment URL rewriting, stream entry builder |
| `src/services/stripchatKeys.ts` | `pkey` extraction from the master m3u8, cached and invalidated on stale-advert detection |
| `src/services/stripchatMouflon.ts` | MOUFLON v2 `pdkey` registry (from `PD_KEY_*` env), segment URI decryption, playlist normalization |

**Routes** (registered in `src/createExpressApp.ts` before the `/:config` catch-all; stateless, no config prefix):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/stripchat/hls/:username/:quality` | Serve a decrypted, web-ready master or variant m3u8. `quality` is `auto`/`source` or a resolution like `1920x1080`. |
| `GET` | `/stripchat/seg?url=<encoded>` | Fetch a segment or sub-playlist from doppiocdn. Sub-playlists are re-decrypted; segments are passthrough. SSRF-guarded to doppiocdn hosts only. |

The `pdkey` pairs are not in the repo. Load them via env vars of the form `PD_KEY_<pkey>=<pkey>:<pdkey>` (one per known MOUFLON v2 pair). Source: community reverse-engineering linked in `src/services/stripchatMouflon.ts`.

---

## HTTP API

Beyond the Stremio protocol endpoints (`/manifest.json`, `/{config}/catalog/...`, `/{config}/meta/...`, `/{config}/stream/...`), the addon exposes:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/health` | none | `{ status, version, timestamp }`. Used by the Docker `HEALTHCHECK`. |
| `GET` | `/` | none | 301 redirect to `/configure`. |
| `GET` | `/configure` | none | Next.js configure page (per-request nonced CSP). |
| `GET`/`POST` | `/configure/install` | none | Install-URL generator (POST form, or GET with query params for legacy deep-link installs). |
| `GET` | `/stripchat/hls/:username/:quality` | none | Stripchat HLS proxy - see [Stripchat](#stripchat-live-cams). |
| `GET` | `/stripchat/seg?url=` | none | Stripchat segment/sub-playlist proxy (doppiocdn-only SSRF guard). |
| `GET`/`POST`/`DELETE` | `/api/favorites` | same-origin | Per-instance favorites list (Redis-backed). |
| `GET`/`POST`/`DELETE` | `/api/profile/*` | same-origin + Stremio authKey | AES-256-GCM encrypted saved-config slots keyed off the Stremio user email. Requires `SESSION_SECRET` + `MONGODB_URI`. |
| `POST` | `/admin/flush-cat-cache` | `X-Admin-Token: <ADMIN_TOKEN>` | Deletes every `cat:v1:*` Redis key matching a backend URL prefix. Requires `ADMIN_TOKEN`. |

The Stremio resource routes also exist in a config-less form (`/manifest.json`, `/catalog`, `/meta`, `/stream`) that proxy the Go backend's `default` manifest/config; the `/{config}/...` form is what installed addons hit.

---

## Local Development

```bash
npm install
BACKEND_URL=https://your-backend.example.com node --watch src/server.ts
# Open http://localhost:7000/configure
```

Or with Docker:

```bash
docker build -t stremio-tpb-porn .
docker run -p 7000:7000 -e BACKEND_URL=https://your-backend.example.com stremio-tpb-porn
```

---

## Documentation

Full internal documentation in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | High-level overview, request flow, config and provider wiring |
| [`docs/code-structure.md`](docs/code-structure.md) | Module-by-module tour of every file in `src/` |
| [`docs/configuration.md`](docs/configuration.md) | All environment variables, defaults, and precedence rules |
| [`docs/providers-and-streams.md`](docs/providers-and-streams.md) | Debrid provider internals, sources, TPDB/StashDB metadata |
| [`docs/stripchat.md`](docs/stripchat.md) | Stripchat live cam HLS proxy: MOUFLON v2 decryption, routes, env |
| [`docs/development.md`](docs/development.md) | Local setup, Docker, Redis, testing tips |

---

## Related

- **[Adult Addons](https://adult-addons.click)** - curated directory of NSFW Stremio addons with one-click install links
- **[torrent-search-go](https://github.com/ghostyshell/torrent-search-go)** - the Go backend that powers scraping, catalog, and meta
- **[r/StremioAddons thread](https://www.reddit.com/r/StremioAddons/comments/1tsi6nu/nsfw_addon_for_4k_adult_content/)** - NSFW addon for 4K adult content discussion
- **[r/StremioAddonsNSFW](https://www.reddit.com/r/StremioAddonsNSFW/)** - community for NSFW Stremio addons
- **[r/TPB4KPorn](https://www.reddit.com/r/TPB4KPorn/)** - this addon's subreddit

---

## License

GPL-3.0-or-later - see [LICENSE](LICENSE).
