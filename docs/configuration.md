# Configuration

This document covers every configuration option available to operators and end users: environment variables, per-user URL-encoded config fields, defaults, and precedence rules.

---

## Precedence Order

Configuration is merged from three layers, lowest to highest priority:

```
1. Hardcoded defaults (in src/utils/config.js DEFAULT_CONFIG)
        ↓  overridden by
2. Server-side environment variables (set by the operator at deploy time)
        ↓  overridden by
3. Per-user config (base64url-encoded JSON in the install URL)
```

Empty-string values in the per-user config are excluded from the merge so they cannot accidentally clobber a non-empty env var (e.g. a user sending `backendUrl: ""` will not replace a real `BACKEND_URL`).

---

## Server-Side Environment Variables

These are set at deploy time by the operator. They apply to every user who installs the addon.

### Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | no | `7000` | TCP port the HTTP server listens on. |
| `BACKEND_URL` | yes* | — | Base URL of the external torrent-search backend API. Required for piratebay/HiddenBay catalogs and PornRips catalogs. Example: `https://your-backend.example.com` |
| `ADDON_API_TOKEN` | no | — | Bearer token sent to the backend if it requires authentication (`Authorization: Bearer …` + `X-Addon-Token: …`). |
| `ADULT_SOURCE` | no | `piratebay` | Default torrent source for catalogs. One of: `piratebay`, `hiddenbay`, `torrentgalaxy`, `magnetdl`, `limetorrents`, `pornrips`, `all`. When `all`, results from every source are fetched in parallel and deduplicated. |

> `BACKEND_URL` is required for piratebay/HiddenBay and PornRips catalogs. TorrentGalaxy, MagnetDL, and LimeTorrents are scraped directly in-addon when included via `ADULT_SOURCE=all`, so they do not need the backend.

### Metadata

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TPDB_API_KEY` | no | — | API key for ThePornDB (api.theporndb.net). Enables scene/performer metadata enrichment on the server side. Individual users can also supply their own key on the configure page. |
| `TPDB_API_URL` | no | `https://api.theporndb.net` | Override the ThePornDB API base URL. Rewrites the old `api.metadataapi.net` host automatically. |
| `STASHDB_API_KEY` | no | — | API key for StashDB (stashdb.org GraphQL). Enables additional scene metadata, merged per-field with TPDB. A free account is required (invite via Discourse/Discord). |
| `STASHDB_API_URL` | no | `https://stashdb.org` | Override the StashDB base URL. |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | no | — | Redis connection URL (e.g. `redis://localhost:6379`). When unset, all caches degrade to no-ops (no persistence, no background enrichment). |
| `REDIS_PASSWORD` | no | — | Overrides any password embedded in `REDIS_URL`. |

### MongoDB (optional — offload Redis memory)

The caches split into two tiers. **Ephemeral, hot, short-TTL** data (catalog lists, debrid stream links, images, torrent records, sections, per-user lookups) always stays on Redis. The **persistent, install-agnostic metadata stores** — which grow steadily under a 7–30 day TTL and are the main driver of Redis memory growth — can be routed to MongoDB instead by setting `MONGODB_URI`.

Stores moved to Mongo when enabled: `tpdb-shared` + `stashdb-shared` (matched scene metadata, 30 d), `refmeta` (reference fallback, 7 d), `prmagnet` (resolved PornRips magnets, 30 d), `stashtag` (StashDB tag ids, 30 d). They keep the identical interface, so behavior is unchanged apart from where the bytes live. A small in-process LRU fronts them so hot request-path reads don't pay a Mongo round trip.

All Mongo cache documents live in one collection (`{ _id, v, exp }`) with a TTL index on `exp` that expires entries exactly like Redis `EX`. When `MONGODB_URI` is unset, everything stays on Redis (zero behavior change). When Mongo is configured but unreachable, the persistent stores degrade to misses (the addon keeps working, just re-fetching metadata).

Credentials are supplied as separate vars (not embedded in the URI), so a password with special characters needs no URL-encoding.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | no | — | MongoDB host connection string, e.g. `mongodb://mongo-mnmk.internal` or `mongodb+srv://cluster.example.net`. When set, the persistent metadata stores move from Redis to Mongo. (`MONGO_URL` accepted as a fallback.) |
| `MONGO_USERNAME` | no | — | Auth username. Applied as a driver auth option. |
| `MONGO_PASSWORD` | no | — | Auth password. Applied as a driver auth option (no URI escaping needed). |
| `MONGO_AUTH_SOURCE` | no | `admin` | Auth database. Defaults to `admin` (used only when a username/password is set); set to your app DB for a scoped user. |
| `MONGODB_DB` | no | `tpb_addon` | Database name. (`MONGO_DB` accepted as a fallback.) |
| `MONGO_COLLECTION` | no | `cache` | Collection holding all cache documents. |
| `MONGO_POOL_SIZE` | no | `10` | Max connection-pool size. |
| `MONGO_TIMEOUT_MS` | no | `5000` | Server-selection timeout. |
| `MONGO_SOCKET_TIMEOUT_MS` | no | `20000` | Socket timeout for operations. |
| `MONGO_HOT` | no | `1` | In-process LRU read-through for the Mongo-backed stores. Set `0` to disable. |
| `MONGO_HOT_MAX` | no | `5000` | Max entries in the per-store hot LRU. |
| `MONGO_HOT_TTL_MS` | no | `60000` | Hot-LRU entry TTL (ms). Staleness is bounded by this; harmless against 7–30 d store TTLs. |
**Rollout:** set `MONGODB_URI` (+ `MONGO_USERNAME`/`MONGO_PASSWORD`) → new persistent-store writes go to Mongo; existing Redis persistent keys age out on their own TTLs. Redis memory falls as keys expire on the (shortened) TTLs below.

### Redis cache TTLs

Every ephemeral (Redis-backed) cache lifetime is env-tunable (seconds), so you can shorten lifetimes to cap Redis memory without a redeploy. Defaults are already conservative; lower them further if memory is tight. These apply only to the hot Redis tier — the persistent metadata stores keep their long TTLs (and live in Mongo when enabled).

| Variable | Default | Cache | Notes |
|----------|---------|-------|-------|
| `TTL_TORRENT_STORE_S` | `21600` (6 h) | torrent records | Fallback only — the stream/meta id carries infoHash/title/urls, so expiry is non-fatal. |
| `TTL_IMAGE_S` | `43200` (12 h) | poster/cover URLs | Fallback (backend also returns covers inline); expiry just re-scrapes. |
| `TTL_STREAM_S` | `7200` (2 h) | debrid-resolved links | Provider CDN URLs expire anyway; re-resolution is one call. |
| `TTL_CATALOG_S` | `900` (15 m) | catalog torrent lists | Base for the jittered write TTL (±10%) used by the catalog route + warmer. |
| `TTL_PROXIED_CAT_S` | `900` (15 m) | PornTube / Hentai catalog lists | |
| `TTL_PERKEY_META_S` | `43200` (12 h) | per-user TPDB/StashDB lookups | Keyed by the user's own API key. |
| `TTL_CATEGORY_S` | `21600` (6 h) | category-catalog lists | Repopulated by the category warmer ~every 3 h. |
| `TTL_SECTION_S` | `300` (5 m) | backend section/config blob | |

### Networking & Proxy

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRUST_PROXY_HOPS` | no | `1` | Number of reverse proxy hops to trust for `X-Forwarded-For` / `X-Forwarded-Proto`. Set to `1` for a single proxy in front of the app, `2` for Cloudflare + your proxy, etc. Capped at 5. |
| `ALLOW_USER_BACKEND` | no | — | When set (any non-empty value), users can supply their own `backendUrl` in the configure form even when `BACKEND_URL` is set server-side. By default a server-side `BACKEND_URL` takes precedence unconditionally. |

### Reference Addon (optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REFERENCE_ADDON_URL` | no | — | Base URL of an external reference addon used as a metadata fallback for PornRips items when TPDB finds no match. Provides enriched scene names, covers, and descriptions. Leave unset to disable this fallback. |

### Tuning

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAX_BASES_PER_INSTANCE` | no | `30` | Maximum number of catalog bases per multi-instance split chunk. Lower this if Stremio rejects the manifest for size (each base expands to two catalogs). Minimum 1. |
| `TPDB_MIN_INTERVAL_MS` | no | `400` | Minimum milliseconds between consecutive TPDB API calls. Increase to reduce TPDB rate-limit errors. |
| `TPDB_COOLDOWN_MS` | no | `120000` | Pause duration (in ms) after a TPDB rate-limit response before retrying. |
| `ADMIN_TOKEN` | no | — | Secret token for the `/admin/flush-cat-cache` endpoint. Send as `X-Admin-Token` header. Leave unset to disable the endpoint. |

#### Redis / MongoDB resource caps

These are **service-level** settings for the Redis and MongoDB containers, not addon env vars. They are documented here because the defaults in this repo are sized for small VPS / Sliplane boxes (~8 GB RAM). On an unconstrained server Redis and MongoDB will happily consume most of the host memory.

| Service | Recommended cap | How to set |
|---------|-----------------|------------|
| Redis | `maxmemory 1gb` + `maxmemory-policy allkeys-lru` | In the Redis container's `redis.conf`, or via the Sliplane Redis service settings. Evicts least-recently-used keys when the cap is hit. |
| MongoDB | `--wiredTigerCacheSizeGB 0.5` | Add to the `mongod` command line, or set `storage.wiredTiger.engineConfig.cacheSizeGB: 0.5` in `/etc/mongod.conf`. Capping this is the single biggest lever for reducing `mongod` RSS. |

Combined with the shortened Redis TTLs above and the background-job tuning below, these caps keep the steady-state footprint low enough for a 2-vCPU / 8-GB Sliplane box.

### Rate Limiting

Per-IP request limiting + a broad DDoS backstop (see `src/utils/rateLimit.js`). All windows are sliding.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Sliding window length (ms) shared by both limiters. |
| `RATE_LIMIT_STREMIO_MAX` | no | `300` | Max requests per IP per window for the Stremio resource endpoints (manifest/catalog/meta/stream). A single Stremio session legitimately fires many requests, so keep this generous. |
| `RATE_LIMIT_GLOBAL_MAX` | no | `600` | App-wide per-IP flood ceiling across every path (health checks exempt). Lower it to clamp abusive bursts harder. |

### Background Jobs (CPU / Redis tuning)

The four background warmers — cache warmer, reference warmer, metadata enricher, and category warmer — are the main driver of steady-state CPU and Redis load. Every interval/cap below is env-tunable so the schedule can be slowed without a redeploy. Runs are **non-overlapping** (a slow run never has a second copy started on top of it) and start times are **jittered** so jobs don't realign into a combined spike.

**Disable switches**

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_BACKGROUND_JOBS` | — | Global kill switch: when truthy (`1`/`true`/`yes`), disables every warmer. |
| `DISABLE_CACHE_WARMER` | — | Disable the catalog cache warmer only. |
| `DISABLE_STUDIO_WARMER` | — | Disable the per-studio metadata warming pass only. |
| `DISABLE_REF_WARMER` | — | Disable the reference / PornRips / StashDB warmer only. |
| `DISABLE_META_ENRICHER` | — | Disable the live TPDB/StashDB metadata enricher only. |
| `DISABLE_CATEGORY_WARMER` | — | Disable the TPDB/StashDB category-catalog warmer only. |

**Pacing & caps** (raise the intervals or lower the caps to shed load)

| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_WARMER_INITIAL_MS` / `CACHE_WARMER_INTERVAL_MS` | `60000` / `1200000` | Catalog cache warmer first-run delay / repeat interval (20 min). |
| `STUDIO_WARMER_INITIAL_MS` / `STUDIO_WARMER_INTERVAL_MS` | `180000` / `3600000` | Studio-metadata warming first-run delay / interval (hourly). |
| `STUDIO_WARMER_DELAY_MS` | `150` | Pause between per-studio backend searches. |
| `REF_WARMER_INITIAL_MS` / `REF_WARMER_INTERVAL_MS` | `90000` / `3600000` | Reference warmer first-run delay / interval (hourly). |
| `REF_WARMER_SCAN_LIMIT` | `2000` | Max shared keys examined per reference-warmer run. |
| `REF_WARMER_MAX_FIX` | `150` | Max incomplete entries repaired per run. |
| `REF_WARMER_CONCURRENCY` | `6` | Concurrency for the completeness-sweep repairs. |
| `REF_WARMER_STASHDB_MAX` | `150` | Hard cap on **new** StashDB searches per run. Already-resolved slugs are skipped, so this bounds the remaining work (the dominant old CPU/StashDB spike). |
| `REF_WARMER_STASHDB_BATCH` | `16` | StashDB searches issued per concurrent batch. |
| `REF_WARMER_STASHDB_DELAY_MS` | `300` | Pause between StashDB batches. |
| `META_ENRICHER_INITIAL_MS` / `META_ENRICHER_INTERVAL_MS` | `5000` / `60000` | Enricher first-run delay / tick interval. |
| `META_ENRICHER_MAX_PER_TICK` | `150` | Max queued items processed per tick. |
| `META_ENRICHER_MAX_QUEUE` | `5000` | Hard cap on the pending-lookup queue (bounds memory under traffic spikes). |
| `META_ENRICHER_CONCURRENCY` | `2` | Per-service concurrency for live lookups. |
| `CATEGORY_WARMER_INITIAL_MS` / `CATEGORY_WARMER_INTERVAL_MS` | `300000` / `10800000` | Category warmer first-run delay / interval (3 h). |

---

## Per-User Config Fields

These are set by end users on the configure page (`/configure`) and encoded into their personal install URL as a base64url JSON blob. The operator never sees these values — they live entirely in the URL.

### Debrid Provider Keys

Only **one** debrid key may be active at a time. When multiple are present in a malformed config, the highest-priority key wins and all others are cleared.

Priority order (highest first):

| Field | Provider | How to obtain |
|-------|----------|---------------|
| `rdKey` | Real-Debrid | [real-debrid.com/apitoken](https://real-debrid.com/apitoken) |
| `adKey` | AllDebrid | [alldebrid.com/apikeys](https://alldebrid.com/apikeys) |
| `tbKey` | TorBox | [torbox.app/settings](https://torbox.app/settings) → API Keys |
| `pmKey` | Premiumize | [premiumize.me/account](https://www.premiumize.me/account) → API |
| `edKey` | EasyDebrid | [easydebrid.com/settings](https://easydebrid.com/settings) |
| `dlKey` | Debrid-Link | [debrid-link.com/webapp/apikey](https://debrid-link.com/webapp/apikey) |
| `ocKey` | Offcloud | [offcloud.com/#/account](https://offcloud.com/#/account) |
| `puKey` | Put.io | [put.io/oauth/apps](https://put.io/oauth/apps) (OAuth token) |
| `dpKey` | Deepbrid | [deepbrid.com/devices](https://www.deepbrid.com/devices) |
| `lsKey` | LinkSnappy | `username:password` from [linksnappy.com/myaccount](https://linksnappy.com/myaccount) |
| `mgKey` | Mega-Debrid | [mega-debrid.eu API](https://www.mega-debrid.eu/index.php?page=api) |
| `drKey` | Debrider | [debrider.app/dashboard/account](https://debrider.app/dashboard/account) |
| `srKey` | Seedr | `email:password` from [seedr.cc API](https://www.seedr.cc/docs/api/rest/v1/) |
| `pkKey` | PikPak | Refresh token (`os.…`) from [mypikpak.com](https://mypikpak.com/) |

### Metadata Keys

| Field | Description |
|-------|-------------|
| `tpdbKey` | ThePornDB API key. If the operator has set `TPDB_API_KEY`, this supplements or overrides it per-user. |
| `tpdbUrl` | ThePornDB API base URL override. |
| `stashdbKey` | StashDB GraphQL API key. |
| `stashdbUrl` | StashDB base URL override. |

### Catalog Selection

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sources` | `string[]` | `['piratebay']` | Active content sources. Valid values: `piratebay`, `pornrips`, `porntube`, `hentai`. At least one is always kept. |
| `enabledCatalogs` | `string[] \| null` | `null` | Allow-list of catalog base IDs. When non-null, only these bases appear in the manifest (used by the multi-instance split). `null` means all bases are shown (minus `disabledCatalogs`). |
| `disabledCatalogs` | `string[]` | `[]` | Deny-list of catalog base IDs to hide. Examples: `["xxx_trans", "xxx_studio_vixen"]`. |
| `disabledPrStudios` | `string[]` | `[]` | PornRips studio names to omit from the Studio genre dropdown. |

### Filtering & Display

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxResults` | `integer` | `20` | Maximum number of results per catalog page. Capped at 100. |
| `minSeeders` | `integer` | `3` | Minimum seeders filter applied to TPB results. |
| `hideP2P` | `boolean` | `false` | When `true` and a debrid key is configured, direct torrent (magnet/P2P) fallback streams are suppressed. |
| `hideFromHome` | `boolean` | `false` | When `true`, catalogs are marked with a required `genre` extra so Stremio's Home (Board) screen omits them. The Discover tab and Search still work normally. |
| `namePostfix` | `string` | `""` | Up to 30 characters appended to the addon display name (and folded into the manifest ID). Useful when running multiple instances to tell them apart in Stremio's sidebar. |

### Stream Proxy (MediaFlow)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `proxyDebridStreams` | `boolean` | `false` | Route debrid CDN stream URLs through a MediaFlow proxy. |
| `mediaFlowProxyUrl` | `string` | `""` | Base URL of a self-hosted MediaFlow Proxy instance (e.g. `http://host:8888`). |
| `mediaFlowApiPassword` | `string` | `""` | API password for the MediaFlow Proxy instance. |

### Backend Override (advanced)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backendUrl` | `string` | `""` | Per-user backend URL override. Only accepted when the operator has not set `BACKEND_URL`, or when `ALLOW_USER_BACKEND` is set. Subject to SSRF validation. |
| `backendToken` | `string` | `""` | Bearer token for the user-supplied backend URL. |

### Multi-Instance Identity (auto-set by /configure/install)

These fields are set automatically by the install-URL generator and should not be hand-edited.

| Field | Description |
|-------|-------------|
| `group` | 1-based index of this instance within a catalog-split set. |
| `groupTotal` | Total number of split instances for the same provider. |
| `providerTotal` | Total number of debrid-provider instances. Used to include the provider token in the manifest ID/name. |

---

## Config Encoding

The config is serialised to JSON, Base64-encoded, and URL-safe (`+` → `-`, `/` → `_`, padding stripped):

```js
// Encode
const segment = Buffer.from(JSON.stringify(cfg)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

// Decode
const json = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const cfg  = JSON.parse(json);
```

The resulting segment appears in every install URL and every Stremio API call:

```
https://your-host/{base64config}/manifest.json
https://your-host/{base64config}/catalog/Porn/xxx_top.json
https://your-host/{base64config}/stream/Porn/jstrm:….json
```

---

## Security Notes

- **Debrid keys are per-user and URL-only.** The operator never has access to them. They are never logged server-side (the configure form uses POST with sensitive fields, not GET).
- **Backend URL SSRF protection:** any URL in `backendUrl`, `tpdbUrl`, or `stashdbUrl` is validated before use. Private IP ranges, cloud metadata endpoints, non-http schemes, and embedded credentials are rejected.
- **No server-side debrid credentials.** There are no environment variables for debrid keys. All debrid authentication is done with the per-user key from the encoded config.
