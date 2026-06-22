# Go Backend Migration Guide

The Stremio addon (`tpb-stremio-addon`) was originally a monolith: scraping, caching,
background warmers, metadata enrichment, and the Stremio protocol all ran in Node.
The Go service in `../TorrentSearch/torrent-search-go` is the shared data plane;
this addon should shrink to a **thin Stremio edge**.

## Target architecture

```
Stremio client
      │
      ▼
Node addon (thin edge)                    Go torrent-search backend
├── manifest / configure UI               ├── scrapers (HiddenBay, PornRips, Lime…)
├── parseConfig (per-user URL blob)       ├── cover image pipeline + S3 cache
├── catalog/meta/stream (Stremio JSON)    ├── Redis catalog warming (cat:v1:*)
├── 14 debrid providers (per-user keys)   ├── KV store (addon:xxx_studios, …)
├── CORS + rate limits                    ├── TPDB/StashDB jobs (enricher, category, ref warmer)
└── PornTube/Hentai proxies               └── Stremio manifest/catalog/meta (Phase 3)
```

**Must stay at the edge:** per-user debrid keys, client IP forwarding (RD/TorBox),
URL-encoded install config, configure page, CORS.

**Should live in Go:** scraping, shared Redis/Mongo caches, all background warmers,
cover extraction, TPDB/StashDB enrichment.

## Redis key contract

Catalog list cache keys **must match** between Go and Node:

```
cat:v1:{BACKEND_URL}|{catalogId}|Porn|||0
```

Set on the Go service:

```env
ADDON_CACHE_BASE_URL=https://your-go-api.example.com   # same as addon BACKEND_URL
```

Go's `RedisCatalogCache` job warms browse + studio catalogs. With keys aligned,
the Node addon reads pre-warmed lists without running its own `cacheWarmer`.

**Key-segment alignment (important for `STREMIO_ON_GO=1`):** the first segment
of every `cat:v1:` key is the catalog base URL. The warmer writes it from
`ADDON_CACHE_BASE_URL` (then `BASE_URL`). When the Node addon reads, it uses its
own `BACKEND_URL` — which must equal `ADDON_CACHE_BASE_URL`. When **Go itself**
serves the catalog (Phase 3), the Go Stremio reader now derives the segment from
the *same* `ADDON_CACHE_BASE_URL`/`BASE_URL` (via `jobs.ResolveCatalogBaseURL`),
falling back to `BACKEND_URL` only if neither is set — so you do **not** need to
set `BACKEND_URL` on the Go service for warm-cache hits. On a cache miss the Go
reader now also writes the scraped list back under the same key (paginated,
searched and genre-filtered loads are cached too, matching the Node route).

Search-query keys (when a user searches inside a catalog):

```
cat:v1:{BACKEND_URL}|{catalogId}|Porn|{query}||0
```

## Immediate offload (no code deploy on Go beyond key fix)

On the **addon** `.env`:

```env
BACKEND_URL=https://your-go-api.example.com
ADDON_API_TOKEN=your-shared-secret

# Stop duplicate catalog warming in Node (Go job handles it)
OFFLOAD_JOBS_TO_BACKEND=1

# Route pornrips/limetorrents/hiddenbay through Go API (default on)
OFFLOAD_SCRAPING_TO_BACKEND=1

# Skip cheerio in Node; use Go cover-image cache only
OFFLOAD_COVER_SCRAPING=1

# OFFLOAD_JOBS_TO_BACKEND=1 (above) disables ALL FIVE Node warmers —
# cacheWarmer, studioWarmer, categoryWarmer, metaEnricher, referenceWarmer —
# since every one is now ported to Go. There is no per-job overlap to worry
# about. Use DISABLE_<JOB>=1 only to disable a single job when NOT offloading
# (e.g. DISABLE_REF_WARMER=1).

# Proxy manifest/catalog/meta to Go (stream stays on Node):
# STREMIO_ON_GO=1
```

On the **Go** `.env`:

```env
REDIS_URL=redis://…
ADDON_CACHE_BASE_URL=https://your-go-api.example.com   # must match addon BACKEND_URL
ADDON_API_TOKEN=same-as-addon
BASE_URL=https://your-go-api.example.com
TPDB_API_KEY=...          # optional; enables TPDB category catalogs
STASHDB_API_KEY=...       # optional; enables StashDB category catalogs
REFERENCE_ADDON_URL=...   # optional; PornRips reference metadata warmer
```

Expected memory impact on Node:
- No duplicate `cacheWarmer` / studio warmer intervals
- No cheerio loaded for TG/MDL/Lime/PornRips when offloaded
- No per-request HTML cover scraping

## Migration phases

### Phase 1 — Done in this repo

- [x] Fix Go `cat:v1:` keys (`Porn|||0` not `movie||0`)
- [x] `OFFLOAD_JOBS_TO_BACKEND` disables Node cache/studio warmers
- [x] `OFFLOAD_SCRAPING_TO_BACKEND` routes scrapers through Go API
- [x] `OFFLOAD_COVER_SCRAPING` skips cheerio cover scraping in Node

### Phase 2 — Go jobs (TorrentSearch)

- [x] `categoryWarmer.js` → `category_warmer.go` (+ TPDB/StashDB clients, release matching)
- [x] `metaEnricher.js` → `meta_enricher.go` (+ `POST /api/addon/meta-enqueue`)
- [x] `referenceWarmer.js` → `reference_warmer.go`

Port remaining Node jobs to `internal/services/jobs/`:

| Node job | Go status | Redis keys |
|----------|-----------|------------|
| `cacheWarmer.js` | **Replaced** by `redis_catalog_cache.go` | `cat:v1:*` |
| `categoryWarmer.js` | **Done** — `category_warmer.go` | `catcat:v1:{source}:{slug}` |
| `metaEnricher.js` | **Done** — `meta_enricher.go` | `tpdb-shared:v1:*`, `stashdb-shared:v1:*` |
| `referenceWarmer.js` | **Done** — `reference_warmer.go` | `refmeta:v1:*`, `prmagnet:v1:*` |

### Phase 3 — Go Stremio API (manifest / catalog / meta)

Go serves Stremio protocol JSON at `/stremio/{config}/...`. Node proxies when
`STREMIO_ON_GO=1` (or `OFFLOAD_STREMIO_TO_BACKEND=1`). **Stream stays on Node**
(14 debrid providers + client IP forwarding).

- [x] `internal/stremio/` — manifest, catalog, meta handlers
- [x] Go routes: `GET /stremio/{config}/manifest.json`, `catalog/...`, `meta/...`
- [x] Node proxy (`src/utils/stremioGo.js`) when `STREMIO_ON_GO=1`
- [x] PornRips / PornTube / Hentai catalog handlers in Go
- [x] Manifest extra studios from KV (`addon:xxx_studios`)
- [x] Meta/catalog cover resolution from Go storage cache
- [x] PornRips reference-addon meta fallback (catalog + meta)
- [ ] Stream handler in Go (deferred — per-user debrid keys)

**Addon `.env`:**

```env
STREMIO_ON_GO=1
# alias:
# OFFLOAD_STREMIO_TO_BACKEND=1
```

**Go `.env`:**

```env
STREMIO_EDGE_URL=https://your-addon.example.com   # public Node URL for manifest logo/configureUrl
# falls back to BASE_URL when unset
```

Flow with offload enabled:

```
Stremio → Node (configure + stream/debrid)
       → Go /stremio/{config}/manifest|catalog|meta
```

### Phase 4 — Static configure site

Extract `buildConfigurePage()` from `src/index.js` to static HTML or the
stream-frontend; edge serves JSON only.

## Known limitations / intentional divergences

- **Catalog sources in Go are piratebay/HiddenBay only.** The Node addon can
  aggregate multiple trackers when `ADULT_SOURCE=all` (torrentgalaxy, magnetdl,
  limetorrents), but those scrapers are not ported to Go (torrentgalaxy/magnetdl
  don't exist there, and the Go lime scraper has no browse). Before setting
  `STREMIO_ON_GO=1`, confirm the deployment runs `ADULT_SOURCE=piratebay` (the
  default). Go logs a startup `WARNING` if `ADULT_SOURCE` is anything else, and
  those `xxx_*` catalogs fall back to piratebay-only.
- **Root (no-config) install stays on Node.** Only `/{config}/...` routes proxy
  to Go; the bare `/manifest.json`, `/catalog`, `/meta` (used by the public
  addon-catalog listing) are always served by Node. This is intentional.

## What not to migrate

- **Debrid resolution** — per-user API keys must not be centralized on the Go server
- **Configure form secrets** — POST to avoid logging keys
- **Favorites API** — browser same-origin UX feature, low cost

## Verifying offload works

1. Trigger Go catalog cache job (monitoring dashboard or `POST /api/monitoring/redis-catalog-cache-trigger`)
2. Check Redis: `KEYS cat:v1:*` — keys should contain `|Porn|||0`
3. Install addon with `OFFLOAD_JOBS_TO_BACKEND=1`
4. Open a catalog in Stremio — addon logs should show cache hits, no `[cache-warmer]` lines
5. `node --max-old-space-size=256` should stay stable under load
