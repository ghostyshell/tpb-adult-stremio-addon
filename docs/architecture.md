# Architecture

This document describes the high-level design of the TPB Porn Stremio Addon - how a Stremio addon works in general, how this one implements each resource, and how configuration, caching, and providers plug in to the request lifecycle.

---

## What is a Stremio Addon?

A Stremio addon is an HTTP server that serves a small set of JSON endpoints the Stremio client knows how to call. Stremio discovers what an addon can do from its **manifest** (`/manifest.json`) and then calls the relevant resource endpoint whenever the user opens something in the UI.

The three resource endpoints this addon implements:

| Resource | URL pattern | Purpose |
|----------|-------------|---------|
| `catalog` | `/{config}/catalog/{type}/{id}.json` | Browse or search a list of items |
| `meta` | `/{config}/meta/{type}/{id}.json` | Full metadata for a single item |
| `stream` | `/{config}/stream/{type}/{id}.json` | Playable stream URLs for an item |

The `{config}` segment is a **base64url-encoded JSON object** containing all user settings (debrid key, backend URL, selected catalogs, etc.). This means the server is stateless per-request: all user preferences travel in the URL, not in a session or cookie.

---

## Request Lifecycle

```
Stremio client
      │
      │  GET /{config}/manifest.json
      ▼
┌─────────────────────────────────────────────────────────┐
│  Express server (src/index.js)                          │
│                                                         │
│  1. Rate limiting (globalLimiter / stremioLimiter)      │
│  2. CORS headers (open for all Stremio resource routes) │
│  3. Config middleware: base64url decode → parseConfig() │
│     → req.addonConfig                                   │
│  4. Route dispatch:                                     │
│      /manifest.json   → buildManifest()                 │
│      /catalog/…       → catalogRouter                   │
│      /meta/…          → metaRouter                      │
│      /stream/…        → streamRouter                    │
└─────────────────────────────────────────────────────────┘
```

### Config Parsing

Every request to `/{config}/…` runs `parseConfig(req.params.config)` before the route handler fires. This:

1. Base64url-decodes the segment to a UTF-8 JSON string.
2. Merges (lowest → highest priority): **hardcoded defaults** → **server env vars** → **per-user URL config**.
3. Enforces mutual exclusion across debrid keys (only the highest-priority active key survives).
4. Validates SSRF-unsafe URLs for `backendUrl`, `tpdbUrl`, `stashdbUrl`.
5. Normalises booleans, integers, and array fields.

The result is attached to `req.addonConfig` for every downstream handler.

---

## Manifest → Catalog → Meta → Stream Flow

```
User visits /configure
      │
      │  Submits form (POST /configure/install)
      ▼
buildInstallResponse()
  ├── Determines enabled content sources (piratebay, pornrips, hentai)
  ├── Splits enabled TPB catalog bases into ≤30-base chunks (multi-instance split)
  ├── For each (provider × chunk): encodeConfig(cfg) → base64url segment
  └── Generates stremio:// install URLs

User clicks "Install in Stremio"
      │
Stremio fetches  GET /{config}/manifest.json
      │
      ▼
buildManifest(cfg, baseUrl)
  ├── fetchStudios() - extra studios from backend KV "addon:xxx_studios"
  ├── getAdultCatalogs(studios) → TPB catalog entries (filtered by enabledCatalogs / disabledCatalogs)
  ├── getPornripsManifestCatalogs() → PornRips catalog entries
  ├── getHentaiManifestCatalogs() → proxied Hentai sources
  └── Returns manifest JSON: { id, version, name, catalogs, resources, types, idPrefixes, … }

User browses a catalog
      │
Stremio fetches  GET /{config}/catalog/Porn/{catalogId}.json
      │
      ▼
catalogRouter → handleCatalog()
  ├── Check allow/deny list (enabledCatalogs / disabledCatalogs)
  ├── Proxied sources (pt_/hentai_) → buildProxiedCatalog() → return immediately
  ├── Check Redis cache (catalogCache / pornripsCatalogCache)
  │       hit → skip fetch
  │       miss → fetchCatalogTorrents()
  │               ├── PornRips (pr_) → buildPornripsCatalog()
  │               └── TPB/HiddenBay (xxx_) → buildAdultCatalog()
  │                       └── browseTorrents() / searchTorrents() via backend.js
  ├── buildMetas(cfg, torrents, type)
  │       ├── setTorrent() - persist records to Redis for stream handler
  │       ├── getCoverImage() - concurrency-limited scrape pool (up to 8 parallel)
  │       ├── tpdbGetShared() + stashdbGetShared() - read shared metadata cache
  │       ├── enqueueMetaLookups() - fire-and-forget background enricher
  │       └── mergeMetadata() - field-level merge of TPDB + StashDB results
  └── Returns { metas: [...] }

User opens an item
      │
Stremio fetches  GET /{config}/meta/Porn/{id}.json
      │
      ▼
metaRouter → handleMeta()
  ├── Proxied sources (hs:) → buildProxiedMeta()
  ├── decodeItemId(id) - recover torrent fields from jstrm: ID
  ├── torrentStore.get(id) - full record from Redis
  ├── tpdbGetShared() + stashdbGetShared() - shared metadata
  ├── enqueueMetaLookups() - ensure background enricher has this ID
  ├── Cover-image fallback chain:
  │       1. Merged TPDB/StashDB poster
  │       2. Reference-addon poster (PornRips only)
  │       3. getCoverImage() - backend cache / detail-page scrape
  │       4. placeholderPoster() - SVG data URI
  └── Returns { meta: { id, type, name, poster, background, description, … } }

User clicks Play
      │
Stremio fetches  GET /{config}/stream/Porn/{id}.json
      │
      ▼
streamRouter → handleStream()
  ├── Proxied: hs: → hentaiStreams()
  ├── decodeItemId(id) - recover torrent fields
  ├── getTorrent(id) - full record from Redis
  ├── getActiveProvider(cfg) - find the one active debrid provider
  ├── If provider:
  │       streamsForCustomId()
  │         ├── infoHash known → provider.resolve(apiKey, hash, magnet, userIp)
  │         ├── PornRips no-hash → resolvePornripsTorrentUrl() → magnet / .torrent
  │         │       magnet  → provider.resolve()
  │         │       .torrent → provider.resolveFile()
  │         └── filesToStreams() → [{ url, name, description, behaviorHints }]
  └── P2P fallback (unless hideP2P):
          torrentStreams() → [{ infoHash, sources, name }]
```

---

## Multi-Instance Split

Stremio enforces a "Maximum Descriptor Size" limit on manifests. The full catalog set (147+ catalog bases × 2 variants = 294+ entries) produces a ~32 KB manifest that Stremio rejects on install. The addon solves this by generating **multiple addon instances**, each carrying a subset of catalogs (≤30 bases per instance, controlled by `MAX_BASES_PER_INSTANCE`).

When the user submits the configure form with many catalogs checked:

1. The catalog bases are partitioned into chunks of ≤30.
2. Each chunk is paired with every selected debrid provider.
3. Each `(provider × chunk)` combination becomes a separate encoded config + install URL.
4. The manifest `id` for each instance includes the provider token (`rd`/`ad`/…) and the group number (`g1`/`g2`/…) so Stremio treats them as distinct addons that coexist in the sidebar.

---

## Caching Layer

All caching is delegated to Redis (optional; degrades to no-ops when `REDIS_URL` is unset):

| Cache (Redis prefix) | Contents | TTL |
|---------------------|----------|-----|
| `torrent:v1:` | Full torrent record per `jstrm:` ID | 6 h |
| `img:v1:` | Cover/poster URL per torrent key | 24 h |
| `stream:v1:` | Debrid-resolved file metadata (scoped per user+IP) | 4 h |
| `cat:v1:` | TPB catalog torrent lists | 30 min |
| `cat:pr:v6:` | PornRips catalog torrent lists | 30 min |
| `tpdb-shared:v1:` | TPDB metadata per infoHash - shared across all installs | 30 d |
| `stashdb-shared:v1:` | StashDB metadata per infoHash - shared across all installs | 30 d |
| `refmeta:v1:` | Reference-addon (PornRips) fallback metadata | 7 d |
| `prmagnet:v1:` | Resolved PornRips magnet/.torrent URL per slug | 30 d |
| `cat:hs:v1:` | Hentai proxied catalog lists | 30 min |

The **shared TPDB/StashDB cache** is the addon's key design: once *any* user with a metadata API key has matched a torrent, the result is persisted under the infoHash and served to *every* subsequent user - even those without a key - on next request.

---

## Background Jobs

Three jobs start at server boot and run on intervals:

| Job | File | What it does |
|-----|------|--------------|
| Cache Warmer | `src/jobs/cacheWarmer.js` | Pre-fetches top-level catalog pages (xxx_top, xxx_recent, etc.) into Redis every 20 min. Prevents cold-start latency for the first Stremio request after a restart. |
| Reference Warmer | `src/jobs/referenceWarmer.js` | Crawls the reference addon (PornRips) catalog and pre-populates `refmeta:v1:` so PornRips items get metadata/posters without per-request latency. |
| Meta Enricher | `src/jobs/metaEnricher.js` | Drains the process-global `pendingMetaLookups` Set every 60 s, runs live TPDB/StashDB lookups at paced intervals, and writes positive matches to the shared caches. The routes enqueue IDs fire-and-forget; this job does the actual API work off the request path. |

---

## Content Sources

```
ADULT_SOURCE env or user source selection
         │
         ├── 'piratebay'    → backend.js browseTorrents/searchTorrents (HiddenBay)
         ├── 'torrentgalaxy' → services/torrentgalaxy.js (direct scrape)
         ├── 'magnetdl'     → services/magnetdl.js (direct scrape)
         ├── 'limetorrents' → services/limetorrents.js (direct scrape)
         ├── 'pornrips'     → services/pornrips.js + referenceMeta.js
         ├── 'hentai'       → services/hentai.js (proxied reference addon)
         └── 'all'          → all of the above in parallel, deduplicated by infoHash
```

---

## Security Notes

- **SSRF hardening**: `utils/safeUrl.js` validates every operator-supplied URL (backendUrl, tpdbUrl, stashdbUrl) against private IP ranges, metadata endpoints, non-http(s) schemes, and embedded credentials before use.
- **Rate limiting**: `express-rate-limit` provides a global per-IP flood backstop and a per-route Stremio limiter. The number of trusted proxy hops is set explicitly via `TRUST_PROXY_HOPS` to prevent IP spoofing.
- **Debrid key isolation**: debrid keys live only in the user's encoded config URL - never stored server-side.
- **Favorites CSRF**: the `/api/favorites` write endpoint is restricted to same-origin requests only.
- **Admin token**: the `/admin/flush-cat-cache` endpoint requires `X-Admin-Token: <ADMIN_TOKEN>` header.
