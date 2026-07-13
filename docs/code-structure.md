# Code Structure

A module-by-module tour of every significant file in `src/`, what it owns, its key functions, and how it connects to the rest of the addon.

---

## Top-level

### `src/index.js`

The Express application entry point. Responsibilities:

- Bootstraps the Express app with middleware (CORS, rate limiters, body parsers, static assets).
- Defines all HTTP routes: the configure UI, the `/{config}/manifest|catalog|meta|stream` resource routes, the root redirect, health check (`/health`), and the admin flush endpoint.
- Renders the full configure page and install-URL page as inline HTML strings (no template engine).
- Starts the three background jobs (cache warmer, reference warmer, meta enricher) after the server is listening.
- Handles graceful shutdown on `SIGTERM`/`SIGINT` (closes HTTP server, quits Redis).

Key functions:

| Function | Description |
|----------|-------------|
| `buildInstallResponse(req, res)` | Processes the configure form, partitions catalog bases into multi-instance chunks, generates `stremio://` install URLs per (provider × chunk). |
| `buildConfigurePage()` | Renders the full configure page HTML inline (tabs: Tokens, Streams, Catalogs, Display). |
| `buildInstallPage(instances, …)` | Renders the post-form install page with one card per generated addon instance. |
| `parseConfig` (from utils/config.js) | Decode + validate the `{config}` URL segment into a plain config object. |

---

## `src/manifest.js`

Builds the Stremio manifest JSON dynamically per-request (because catalogs depend on runtime state like extra studios from the backend).

Key exports:

| Export | Description |
|--------|-------------|
| `buildManifest(cfg, baseUrl)` | Async. Fetches extra studios from the backend KV, assembles catalog entries from all enabled sources (TPB, PornRips, Hentai), applies `enabledCatalogs`/`disabledCatalogs` filtering, builds the manifest `id` and `name` with provider + group suffixes. |
| `ADDON_NAME` | String constant - the addon's display name. |
| `PROVIDERS` | Array of `{ field, token, label }` objects, one per debrid provider, in priority order. |
| `detectProvider(cfg)` | Returns the first provider whose key is set in `cfg`, or `null` for P2P-only. |

The `stremioAddonsConfig` object (with an ownership `signature`) is embedded in every manifest to verify the addon listing on stremio-addons.net.

---

## `src/routes/`

### `catalog.js`

Handles `GET /{config}/catalog/{type}/{id}.json`.

Flow:

1. Guard: returns `{ metas: [] }` for catalog IDs not in the config's allow/deny list.
2. Proxied sources (`pt_`/`hentai_`) go directly to `buildProxiedCatalog()`.
3. Check Redis cache; on miss, call `fetchCatalogTorrents()`.
4. Cache non-empty results (30 min ± 5 min jitter).
5. Call `buildMetas()` to turn the torrent list into Stremio MetaPreview objects.

Key functions:

| Function | Description |
|----------|-------------|
| `fetchCatalogTorrents(cfg, catalogId, …)` | Routes to `buildPornripsCatalog()` (pr_) or `buildAdultCatalog()` (xxx_). |
| `buildAdultCatalog(cfg, catalogId, …)` | Fetches from all configured trackers in parallel via `backend.js`, deduplicates by infoHash, sorts by seeders. |
| `buildPornripsCatalog(cfg, catalogId, …)` | Uses `getPornripsParams()` to decide between reference-addon fetch (studio/tag/search) and direct backend browse (recent/all). |
| `buildProxiedCatalog(catalogId, opts)` | Calls the reference addon service (hentai.js), re-namespaces item IDs with `hs:` prefix. |
| `normalizeHbTorrent(t)` | Normalises a torrent object from any source (PascalCase backend fields or camelCase direct-scraper fields) to a consistent camelCase shape. |
| `buildMetas(cfg, torrents, type)` | Stores torrent records to Redis, resolves cover images with a bounded concurrency pool, reads shared TPDB/StashDB metadata, enqueues background enrichment, and assembles Stremio MetaPreview objects. |
| `runLimited(tasks, limit)` | Concurrency limiter (N workers, each draining from a shared task queue). Used for cover image scraping. |
| `mapLimited(items, limit, fn)` | Like `Promise.all` but bounded. Used for reference-addon fallback lookups. |

### `meta.js`

Handles `GET /{config}/meta/{type}/{id}.json`.

- `jstrm:` IDs: decodes the embedded torrent record, reads the stored record from Redis, applies the cover-image fallback chain (TPDB poster → reference poster → backend scrape → SVG placeholder), assembles and returns a full Stremio Meta object.
- `hs:` IDs: proxies to the reference addon's meta endpoint.
- Other IDs (e.g. IMDb `tt…`): returns `{ meta: null }` - this addon does not override Cinemeta.

Key functions:

| Function | Description |
|----------|-------------|
| `handleMeta(req, res)` | Main handler: dispatch by ID prefix, then assemble meta. |
| `buildProxiedMeta(id)` | Fetch and reformat a reference-addon meta for an `hs:` item. |
| `placeholderPoster(title)` | Returns a base64 SVG data URI as a fallback poster when no image is found. |

### `stream.js`

Handles `GET /{config}/stream/{type}/{id}.json`.

- Detects the active debrid provider from the config.
- For `jstrm:` IDs: resolves the torrent (magnet or .torrent file) through the debrid provider, or falls back to a P2P magnet stream.
- For `hs:` IDs: fetches all episode direct-play URLs from the Hentai service, returns them as separate streams.

Key functions:

| Function | Description |
|----------|-------------|
| `streamsForCustomId(cfg, id, provider, userIp)` | Resolves a `jstrm:` item through the active debrid provider. Tries infoHash first; falls back to PornRips URL resolution then .torrent file upload. |
| `torrentStreams(id)` | Returns a P2P magnet stream entry (Stremio plays it via its built-in torrent client). |
| `hentaiStreams(id)` | Returns one stream entry per episode × quality from the Hentai service. |
| `filesToStreams(files, t, tag, cfg)` | Converts debrid-resolved file objects to Stremio stream entries. Applies MediaFlow proxy URL encoding when `proxyDebridStreams` is enabled. |
| `publicClientIp(req)` | Extracts a public IPv4/IPv6 from `req.ip` (skips loopback, link-local, private ranges). Forwarded to debrid providers that support IP attribution (Real-Debrid, TorBox). |

### `favorites.js`

Handles `/api/favorites` (same-origin only). Provides a simple favorites store backed by Redis (or in-memory fallback). Used by the configure page to let users bookmark addons.

---

## `src/services/`

### `backend.js`

The HTTP client for the external torrent-search backend API. All piratebay/HiddenBay and PornRips catalog data flows through this module.

Key functions:

| Function | Description |
|----------|-------------|
| `browseTorrents(backendUrl, token, opts)` | Fetch a paginated list of torrents from the backend by category/website/sort. Returns a raw array (cover images inline when `includeCoverImages: true`). |
| `searchTorrents(backendUrl, token, opts)` | Same as browse but with a search query parameter. |
| `fetchStudios(backendUrl, token)` | Fetch the KV key `addon:xxx_studios` from the backend - an array of extra studio names merged into the manifest. |
| `fetchKV(base, headers, key)` | Generic KV fetch from the backend API. |

Also imports and re-exports the direct scraper modules (`torrentgalaxy.js`, `magnetdl.js`, `limetorrents.js`, `pornrips.js`) when multi-source mode is active.

### Debrid Service Modules

Each of the 12 debrid providers has its own module with the same interface:

| Module | Provider | Auth type |
|--------|----------|-----------|
| `realdebrid.js` | Real-Debrid | Bearer API key |
| `torbox.js` | TorBox | Bearer API key |
| `premiumize.js` | Premiumize | API key param |
| `easydebrid.js` | EasyDebrid | API key param |
| `debridlink.js` | Debrid-Link | Bearer API key |
| `offcloud.js` | Offcloud | API key param |
| `putio.js` | Put.io | OAuth token |
| `deepbrid.js` | Deepbrid | API key param |
| `linksnappy.js` | LinkSnappy | username:password |
| `megadebrid.js` | Mega-Debrid | API token |
| `debrider.js` | Debrider | API key param |
| `seedr.js` | Seedr | email:password |

Every module exports:

```js
resolveStreams(apiKey, infoHash, magnetLink, userIp?) → Promise<FileResult[]>
resolveStreamsFromTorrentFile(apiKey, torrentUrl, userIp?) → Promise<FileResult[]>
```

Where `FileResult` is `{ fileName, fileSize, url }`.

The stream cache (`stream:v1:`) is keyed per `(scope(apiKey, userIp), infoHash)` so CDN URLs minted for one user are never served to another.

### `hiddenbay.js`

Scrapes cover images from torrent detail pages on HiddenBay and related sites. Resolves NFO image host links (pixhost, imageban, etc.) to direct image URLs. Results are cached in `imageCache` (Redis, 24 h TTL).

### `tpdb.js`

Client for ThePornDB (api.theporndb.net). Queries the `/scenes`, `/movies`, and `/performers` endpoints with a torrent title string. Uses a three-layer caching model:

1. **Shared cache** (`tpdb-shared:v1:`, 30 d): indexed by infoHash, shared across all installs.
2. **Per-key cache** (`tpdb:v1:`, 24 h): indexed by `(key, title)`, avoids re-querying.
3. **Negative cache** (1 h): prevents repeated queries for titles that never match.

A global request queue (`requestTail`) and `MIN_INTERVAL_MS` pacing ensure calls are serialised, respecting TPDB's rate limit.

### `stashdb.js`

Client for StashDB (stashdb.org GraphQL). Queries scenes by URL and title. Mirrors the TPDB caching model with `stashdb-shared:v1:` and `stashdb:v1:` namespaces. Results are merged with TPDB data per-field by `utils/metaMerge.js`.

### `referenceMeta.js`

Fetches metadata and catalog data from a reference PornRips addon (covers, titles, descriptions). Used as a fallback when the addon's own TPDB/StashDB lookup fails. Results are cached in `refmeta:v1:` (7 d).

### `hentai.js`

Thin HTTP client for the proxied external Hentai reference addon. It implements:

- `getCatalog(catalogId, opts)` - returns MetaPreview objects with the external addon's IDs.
- `getMeta(id)` - returns a Meta object for a single item.
- `getStreams(id)` - returns stream entries (direct video URLs per episode).

---

## `src/utils/`

### `config.js`

Parses and validates the base64url config segment.

| Export | Description |
|--------|-------------|
| `parseConfig(encoded?)` | Decodes, merges, sanitises, and validates the config. No encoded arg → server-side env config only. |
| `encodeConfig(cfg)` | Serialises a config object to a base64url string. |
| `DEFAULT_CONFIG` | The complete set of default values for every config field. |

### `debridProviders.js`

Central registry of all 12 debrid providers. Each entry:

```js
{
  field: 'rdKey',           // config key that holds the API key
  token: 'rd',             // short token embedded in manifest id / name
  label: 'Real-Debrid',    // human-readable name
  tag:   'RD',             // stream name prefix
  usesIp: true,            // whether to forward userIp to the provider
  resolve: rdResolveStreams,
  resolveFile: rdResolveFromFile,
}
```

| Export | Description |
|--------|-------------|
| `DEBRID_PROVIDERS` | Ordered array (priority order). |
| `DEBRID_KEY_FIELDS` | Array of all config key names (`rdKey`, `tbKey`, …). |
| `getActiveProvider(cfg)` | Returns the first provider whose key is non-empty in `cfg`. |
| `hasDebridKey(cfg)` | Returns `true` if any debrid key is set. |

### `cache.js`

All Redis-backed cache instances. Each is a `RedisCache` with a prefix and default TTL. When Redis is unavailable every operation degrades to a no-op / miss with no thrown error.

See [architecture.md - Caching Layer](architecture.md#caching-layer) for the full table of caches.

### `redis.js`

Thin wrapper around `ioredis`. Connects when `REDIS_URL` is set; exports individual async functions (`get`, `set`, `del`, `exists`, `scan`, `hget`, `hset`, …). All functions swallow errors and return safe defaults, so callers never need to try/catch Redis calls.

### `adultSections.js`

Defines the catalog taxonomy: every combination of content type (XXX, Trans, Gay, Lesbian, JAV, studio) × quality (4K/FHD) × sort (Top/Recent) as catalog base IDs and display names. Used by the manifest builder and the configure page checkbox list.

| Export | Description |
|--------|-------------|
| `getAdultCatalogs(studios)` | Returns all catalog entry objects (merged built-in + KV studios). |
| `getCatalogBases()` | Flat array of `{ base, name, orientation }` for every catalog variant. |
| `getHbParams(catalogId)` | Returns backend query params (website, category, sort) for a given catalog ID. |
| `getConfiguredSources()` | Returns the list of sources active for the current process (reads `ADULT_SOURCE` env). |

### `torrent.js`

Item ID encoding/decoding and torrent metadata utilities.

| Export | Description |
|--------|-------------|
| `encodeItemId({ h, t, u, w, d })` | Packs an infoHash, title, torrent URL, website, and detail URL into a compact `jstrm:…` ID. |
| `decodeItemId(id)` | Reverses `encodeItemId`. |
| `parseTorrentTitle(title)` | Extracts a clean title and year from a torrent filename. |
| `qualityTag(title)` | Detects quality label (2160p/4K, 1080p, 720p, etc.) from the filename. |
| `buildMagnet(infoHash, title)` | Assembles a `magnet:?xt=…` string with default trackers. |
| `buildTorrentKey(website, title)` | Stable cache key for a torrent's image. |
| `stableMetaId({ website, detailUrl, infoHash })` | Returns a stable ID for the shared metadata caches (infoHash when available; `pr:<slug>` for PornRips). |
| `fetchInfoHashFromTorrentUrl(url)` | Downloads a `.torrent` file and extracts its infoHash. |
| `extractInfoHash(magnetLink)` | Extracts the lowercase hex infoHash from a magnet URI. |
| `isPornripsUrl(url)` | Returns `true` if a URL belongs to pornrips.to. |
| `pornripsSlug(url)` | Extracts the post slug from a pornrips.to URL. |
| `encodeMediaFlowProxyUrl(…)` | Builds a MediaFlow Proxy URL for a stream (optional stream proxying). |

### `torrentCache.js`

Small module that exposes `getTorrent(id)` and `setTorrent(id, record)` backed by the `torrentStore` Redis cache. Used by the stream and meta handlers to read full torrent records that were written during catalog build.

### `metaMerge.js`

Merges TPDB and StashDB metadata objects at the field level. If TPDB has a poster but StashDB has a better description, both are used. Returns `null` if both inputs are null/empty.

### `pornripsCatalogs.js`

Definitions and utilities specific to PornRips catalogs (studio list, tag list, ID → backend parameter mapping, deduplication of 720p/1080p pairs).

### `externalCatalogs.js`

Utilities for the proxied external source (Hentai): catalog ID mapping between local IDs and the reference addon's IDs, manifest catalog entries.

### `rateLimit.js`

Configures two `express-rate-limit` instances:

- `globalLimiter` - app-wide per-IP flood protection.
- `stremioLimiter` - per-IP limit on Stremio resource endpoints.

### `safeUrl.js`

SSRF protection. `isSafeUrl(url)` returns `{ ok: true }` only for URLs that are:
- `http:` or `https:` scheme
- No embedded credentials
- Not pointing at private/loopback/link-local IP ranges
- Not targeting cloud metadata endpoints (169.254.169.254, etc.)

### `externalGenres.json`

Static JSON file listing available genre options for the external catalog source (Hentai). Avoids a live API call on every manifest build.

---

## `src/jobs/`

### `cacheWarmer.js`

Starts 1 min after boot; repeats every 20 min. Pre-warms the four highest-traffic TPB catalogs (`xxx_top`, `xxx_recent`, `xxx_fhd_top`, `xxx_fhd_recent`) and the PornRips recent catalog. Skips any catalog whose Redis key is already warm.

### `referenceWarmer.js`

Walks the reference PornRips addon catalog pages and pre-populates `refmeta:v1:` keys. Keeps PornRips posters and descriptions available for new items without per-request scraping latency.

### `metaEnricher.js`

The background TPDB/StashDB worker. Drains `pendingMetaLookups` (a process-global `Set` of stable IDs) every 60 s, skips IDs already in the shared caches, and makes live API calls at paced intervals. Only active when `REDIS_URL` is set and at least one metadata key (`TPDB_API_KEY` or `STASHDB_API_KEY`) is configured.
