/**
 * cache.js
 * Redis-backed caches. There is no in-process layer - every cache reads and
 * writes Redis exclusively, so state is shared across restarts and instances.
 * All operations degrade to no-ops / misses when Redis is unavailable
 * (see redis.js), so the addon keeps working without a cache, just uncached.
 *
 * Every method is async (Redis is async). Each cache namespaces its keys with a
 * prefix and applies a default TTL (seconds); values are JSON-serialised.
 *
 * Caches (the data-plane caches - catalog/TPDB/StashDB/cover - moved to the Go
 * backend along with the logic that used them; only the edge caches remain):
 *   torrentStore      - jstrm ID  → torrent record. Read by the stream route;
 *                       written by Go when it serves catalog/meta.
 *   streamCache       - cache key  → debrid-resolved file metadata (RD CDN URLs / TorBox metadata)
 *                       Keys are scoped per user (and per IP for RD) so minted CDN
 *                       URLs and account-specific torrent IDs are never shared.
 *   pornripsMagnetCache - PornRips slug → resolved magnet/.torrent URL (stream route).
 *   porntubeCatalogCache / hentaiCatalogCache - proxied-source catalog lists.
 *   sectionCache      - backendUrl → KV blobs (the studio list for the manifest).
 */


// Resolve the redis helper defensively. If it ever fails to load (stale
// deploy, broken bundle, accidental shadow) the cache methods below must
// degrade to no-ops rather than throwing a ReferenceError that crashes
// every request.
let redis: any = null;
try {
  redis = require('./redis');
} catch (_: any) {
  redis = null;
}

// MongoDB-backed persistent store (optional). When MONGODB_URI is set, the large,
// long-lived install-agnostic metadata caches are routed to Mongo instead of
// Redis to relieve Redis memory pressure (see persistentCache() below). Loaded
// defensively so a missing/broken module degrades to "Redis-only" rather than
// crashing every cache.
let mongo: any = null;
let MongoCache: any = null;
try {
  mongo = require('./mongo');
  ({ MongoCache } = require('./mongoCache'));
} catch (_: any) {
  mongo = null;
  MongoCache = null;
}

const redisGet        = redis && typeof redis.get         === 'function' ? (key: string): Promise<string | null>    => redis.get(key)               : async (_k: string): Promise<string | null>     => null;
const redisMget       = redis && typeof redis.mget        === 'function' ? (keys: string[]): Promise<(string | null)[]> => redis.mget(keys)           : async (keys: string[]): Promise<(string | null)[]> => keys.map(() => null);
const redisSet        = redis && typeof redis.set         === 'function' ? (key: string, val: string, ttl: number): Promise<void> => redis.set(key, val, ttl) : async (): Promise<void> => {};
const redisExists     = redis && typeof redis.exists      === 'function' ? (key: string): Promise<number>      => redis.exists(key)             : async (_k: string): Promise<number>            => 0;
const redisExistsMany = redis && typeof redis.existsMany  === 'function' ? (keys: string[]): Promise<boolean[]> => redis.existsMany(keys)        : async (keys: string[]): Promise<boolean[]>     => keys.map(() => false);
const redisDel        = redis && typeof redis.del         === 'function' ? (key: string): Promise<void>        => redis.del(key)                : async (): Promise<void>                        => {};
const redisScan       = redis && typeof redis.scan        === 'function' ? (pattern: string, limit: number): Promise<string[]> => redis.scan(pattern, limit) : async (): Promise<string[]> => [];

/**
 * A Redis-backed cache with an async LRU-like interface (get/set/has/delete).
 * Keys are prefixed for namespacing; values are JSON round-tripped.
 */
class RedisCache {
  prefix: string;
  ttl: number;

  constructor(prefix: string, ttlSeconds: number) {
    this.prefix = prefix;
    this.ttl = ttlSeconds;
  }

  _key(key: string): string {
    return `${this.prefix}${key}`;
  }

  /** Returns the stored value, or undefined on miss / parse error. */
  async get(key: string): Promise<unknown> {
    const raw = await redisGet(this._key(key));
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw);
    } catch (_: any) {
      return undefined;
    }
  }

  /**
   * Batched get. Returns an array aligned to `keys` (undefined on miss / parse
   * error) using a single pipelined MGET - one round trip instead of one GET
   * per key. Used by the background warmers to read large key batches cheaply.
   */
  async getMany(keys: string[]): Promise<unknown[]> {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    const raws = await redisMget(keys.map((k) => this._key(k)));
    return raws.map((raw) => {
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw);
      } catch (_: any) {
        return undefined;
      }
    });
  }

  /** Store a value. Pass ttlSeconds to override this cache's default TTL. */
  async set(key: string, value: unknown, ttlSeconds: number = this.ttl): Promise<void> {
    await redisSet(this._key(key), JSON.stringify(value), ttlSeconds);
  }

  /** Whether a key currently exists. */
  async has(key: string): Promise<boolean> {
    // redis.exists() returns a boolean; the no-op fallback returns 0. Coerce to
    // a truthy check so both shapes work (a `=== 1` test silently failed here).
    return !!(await redisExists(this._key(key)));
  }

  /**
   * Batched existence check. Returns a boolean array aligned to `keys`, using a
   * single pipelined EXISTS round trip. Cheaper than getMany when only presence
   * matters (no value bytes transferred).
   */
  async hasMany(keys: string[]): Promise<boolean[]> {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    return redisExistsMany(keys.map((k: string) => this._key(k)));
  }

  /** Delete a key. */
  async delete(key: string): Promise<void> {
    await redisDel(this._key(key));
  }

  /**
   * Scan keys in this namespace matching `subPattern` (a glob relative to the
   * prefix, e.g. "pr:*"). Returns un-prefixed keys, capped at `limit`.
   */
  async keys(subPattern = '*', limit = 1000): Promise<string[]> {
    const full = await redisScan(`${this.prefix}${subPattern}`, limit);
    return full.map((k: string) => k.slice(this.prefix.length));
  }
}

// TTLs in seconds.
const HOUR  = 60 * 60;
const DAY   = 24 * HOUR;
const MONTH = 30 * DAY;

// ── Redis-tier TTLs (seconds) ────────────────────────────────────────────────
// Every ephemeral (Redis-backed) cache lifetime is env-tunable so it can be cut
// to cap Redis memory without a redeploy. Defaults were lowered from earlier,
// longer values; lower them further via env if memory is still tight. These
// apply ONLY to the hot/ephemeral tier - the persistent metadata stores keep
// their long TTLs (and live in Mongo when MONGODB_URI is set).
const ttlEnv = (name: string, def: number): number => {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : def;
};

// torrentStore records are reconstructable from the encoded stream id (which
// carries infoHash/title/urls), so this store is a fallback for enrichment
// only - safe to keep short. Was 24 h.
const TTL_TORRENT_STORE = ttlEnv('TTL_TORRENT_STORE_S', 6 * HOUR);
// Poster/cover URLs. Backend also returns covers inline, so this is a fallback;
// expiry just re-scrapes a cover (bounded + re-cached). Was 24 h.
const TTL_IMAGE         = ttlEnv('TTL_IMAGE_S',         12 * HOUR);
// Debrid-resolved links. Provider CDN URLs expire on their own; re-resolution
// is one debrid call. Was 4 h.
const TTL_STREAM        = ttlEnv('TTL_STREAM_S',        2 * HOUR);
// Catalog torrent LISTS (largest churny values). Base for the jittered write
// TTL used by the catalog route + cache warmer. Was 30 min.
const TTL_CATALOG       = ttlEnv('TTL_CATALOG_S',       15 * 60);
// Backend section/config blob. Already tiny.
const TTL_SECTION       = ttlEnv('TTL_SECTION_S',       5 * 60);
// Per-user TPDB/StashDB lookups (keyed by the user's own API key). Was 24 h.
const TTL_PERKEY_META   = ttlEnv('TTL_PERKEY_META_S',   12 * HOUR);
// Category-catalog matched lists. Refreshed by the category warmer every ~3 h,
// so a shorter TTL still stays populated. Was 24 h.
const TTL_CATEGORY      = ttlEnv('TTL_CATEGORY_S',      6 * HOUR);
// Proxied (PornTube / Hentai) catalog lists. Was 30 min.
const TTL_PROXIED_CAT   = ttlEnv('TTL_PROXIED_CAT_S',   15 * 60);

// Whether persistent caches should be backed by MongoDB. True only when
// MONGODB_URI is configured AND the MongoCache module loaded. Otherwise every
// cache stays on Redis (unchanged behavior - zero config impact).
const USE_MONGO = Boolean(mongo && typeof mongo.isEnabled === 'function' && mongo.isEnabled() && typeof MongoCache === 'function');

// In-process hot-layer tuning for the Mongo-backed shared stores (read-through
// LRU). Cuts Mongo round trips for hot request-path reads. Env-tunable; set
// MONGO_HOT=0 to disable the layer entirely.
const HOT_ENABLED = String(process.env.MONGO_HOT || '1').trim() !== '0';
const HOT_MAX     = parseInt(process.env.MONGO_HOT_MAX || '', 10) || 5000;
const HOT_TTL_MS  = parseInt(process.env.MONGO_HOT_TTL_MS || '', 10) || 60 * 1000;

/**
 * Build a cache for a PERSISTENT, install-agnostic metadata store: Mongo-backed
 * (with an in-process hot layer) when MONGODB_URI is set, else Redis-backed.
 * The returned object exposes the identical interface either way, so call sites
 * never change.
 */
function persistentCache(prefix: string, ttlSeconds: number): RedisCache {
  if (USE_MONGO) {
    return new MongoCache(prefix, ttlSeconds, {
      hot:      HOT_ENABLED,
      hotMax:   HOT_MAX,
      hotTtlMs: HOT_TTL_MS,
    });
  }
  return new RedisCache(prefix, ttlSeconds);
}

if (USE_MONGO) {
  console.log(`[cache] persistent metadata stores → MongoDB (hot layer: ${HOT_ENABLED ? 'on' : 'off'})`);
}

// Long enough that a record stays resolvable by the stream/meta route after the
// catalog that created it, but the encoded id also carries the essentials so
// expiry is non-fatal. TTLs come from the env-tunable block above.
// Caches the thin edge still needs. Scraping/catalog/enrichment caches moved to
// the Go backend along with the logic that used them.
//   torrentStore       - jstrm id → torrent record (read by the stream route;
//                        written by Go when it serves catalog/meta)
//   streamCache        - per-user debrid-resolved file metadata (stream route)
//   pornripsMagnetCache - resolved PornRips magnet/.torrent by slug (stream route)
//   porntube/hentaiCatalogCache - proxied-source catalog lists (porntube/hentai)
//   sectionCache       - backend KV blobs (studio list for the manifest)
const torrentStore    = new RedisCache('torrent:v1:',  TTL_TORRENT_STORE);
const streamCache     = new RedisCache('stream:v1:',   TTL_STREAM);
const sectionCache    = new RedisCache('section:v1:',  TTL_SECTION);
const pornripsMagnetCache = persistentCache('prmagnet:v1:', 30 * DAY);
const porntubeCatalogCache = new RedisCache('cat:pt:v1:', TTL_PROXIED_CAT);
const hentaiCatalogCache   = new RedisCache('cat:hs:v1:', TTL_PROXIED_CAT);
// Caches whether a Hentai series has at least one working upstream stream.
// "dead"  = probed and returned no streams (TTL shorter so it can recover).
// "alive" = probed and returned streams (TTL longer because availability is sticky).
// Bump the version suffix whenever the stream-eligibility logic changes (e.g.
// excluding a source) so stale probe results are invalidated. v2: HentaiSea
// sources excluded. v3: entries whose cover URL doesn't resolve to an image
// (e.g. hentai.tv HTML pages) are now dropped, so all items must be re-probed.
const hentaiDeadCache  = new RedisCache('hs:dead:v3:',  30 * 60);
const hentaiAliveCache = new RedisCache('hs:alive:v3:', 4 * HOUR);

// Stripchat variant list cache. The variant URLs returned by the master m3u8
// are stable per model/live-session; 15m is safe.
const stripchatVariantCache = new RedisCache('sc:var:v1:', 15 * 60);
// Stripchat pkey cache, MongoDB-backed when available. pkey is global and
// rotates on MMP bumps (~monthly); 24h TTL is safe. The key-extraction job
// invalidates + refreshes it on stale-pkey detection.
const stripchatKeyCache = persistentCache('sc:key:v1:', 24 * HOUR);

export { torrentStore, streamCache, sectionCache, pornripsMagnetCache, porntubeCatalogCache, hentaiCatalogCache, hentaiDeadCache, hentaiAliveCache, stripchatVariantCache, stripchatKeyCache };
