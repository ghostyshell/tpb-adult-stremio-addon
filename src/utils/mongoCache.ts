
/**
 * mongoCache.js
 * A MongoDB-backed cache exposing the EXACT same async interface as the
 * RedisCache in utils/cache.js (get/getMany/set/has/hasMany/delete/keys), so it
 * is a drop-in replacement for the persistent metadata stores. Values are
 * JSON-serialised into a single shared collection (see utils/mongo.js); each
 * cache namespaces its keys with a string prefix exactly like RedisCache.
 *
 * Optional in-process LRU hot layer:
 *   Request-path reads (catalog / meta) hit the shared stores frequently. To
 *   avoid a Mongo round trip for hot keys - and to shave Mongo load - each
 *   MongoCache can keep a small, bounded, short-TTL in-process LRU of POSITIVE
 *   values. Only real values are cached (never negatives), so it can never
 *   produce a false "has". A stale hot value lasts at most hotTtlMs (default
 *   60 s) which is negligible against these caches' 7-30 day Mongo TTLs.
 */

import * as mongo from './mongo';

// lru-cache is a direct dependency; load defensively so a packaging hiccup
// degrades to "no hot layer" rather than crashing module load.
let LRUCache: any = null;
try {
  ({ LRUCache } = require('lru-cache'));
} catch (_: any) {
  LRUCache = null;
}

class MongoCache {
  prefix: any;
  ttl: any;
  hot: any;

  /**
   * @param {string} prefix       - key namespace, e.g. "tpdb-shared:v1:"
   * @param {number} ttlSeconds   - default document TTL
   * @param {object} [opts]
   * @param {boolean}[opts.hot]      - enable the in-process LRU read-through
   * @param {number} [opts.hotMax]   - max LRU entries (default 5000)
   * @param {number} [opts.hotTtlMs] - LRU entry TTL in ms (default 60000)
   */
  constructor(prefix: string, ttlSeconds: number, opts: any = {}) {
    this.prefix = prefix;
    this.ttl = ttlSeconds;
    this.hot = (opts.hot && LRUCache)
      ? new LRUCache({ max: opts.hotMax || 5000, ttl: opts.hotTtlMs || 60 * 1000 })
      : null;
  }

  _key(key: string) {
    return `${this.prefix}${key}`;
  }

  /** Returns the stored value, or undefined on miss / parse error. */
  async get(key: string) {
    const fk = this._key(key);
    if (this.hot) {
      const cached = this.hot.get(fk);
      if (cached !== undefined) return cached;
    }
    const coll = await mongo.getCollection();
    if (!coll) return undefined;
    try {
      const doc = await coll.findOne(
        { _id: fk, exp: { $gt: new Date() } },
        { projection: { v: 1 } },
      );
      if (!doc) return undefined;
      const value = JSON.parse(doc.v);
      if (this.hot) this.hot.set(fk, value);
      return value;
    } catch (_: any) {
      return undefined;
    }
  }

  /**
   * Batched get. Returns an array aligned to `keys` (undefined on miss). Serves
   * hot-layer hits locally and fetches only the misses from Mongo in one query.
   */
  async getMany(keys: string[]) {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    const fks = keys.map((k) => this._key(k));
    const result = new Array(keys.length).fill(undefined);
    const missIdx: any[] = [];
    for (let i = 0; i < fks.length; i++) {
      if (this.hot) {
        const cached = this.hot.get(fks[i]);
        if (cached !== undefined) { result[i] = cached; continue; }
      }
      missIdx.push(i);
    }
    if (!missIdx.length) return result;

    const coll = await mongo.getCollection();
    if (!coll) return result;
    try {
      const missKeys = missIdx.map((i) => fks[i]);
      const docs = await coll.find(
        { _id: { $in: missKeys }, exp: { $gt: new Date() } },
        { projection: { v: 1 } },
      ).toArray();
      const byId = new Map<any, any>(docs.map((d: any) => [d._id, d.v]));
      for (const i of missIdx) {
        const raw = byId.get(fks[i]);
        if (raw == null) continue;
        try {
          const value = JSON.parse(raw);
          result[i] = value;
          if (this.hot) this.hot.set(fks[i], value);
        } catch (_: any) { /* leave undefined */ }
      }
    } catch (_: any) { /* leave misses undefined */ }
    return result;
  }

  /** Store a value. Pass ttlSeconds to override this cache's default TTL. */
  async set(key: string, value: unknown, ttlSeconds: number = this.ttl) {
    const fk = this._key(key);
    const seconds = ttlSeconds > 0 ? ttlSeconds : this.ttl;
    const exp = new Date(Date.now() + seconds * 1000);
    if (this.hot) this.hot.set(fk, value);
    const coll = await mongo.getCollection();
    if (!coll) return;
    try {
      await coll.updateOne(
        { _id: fk },
        { $set: { v: JSON.stringify(value === undefined ? null : value), exp } },
        { upsert: true },
      );
    } catch (_: any) { /* fire-and-forget, mirrors RedisCache.set */ }
  }

  /** Whether a key currently exists (and is unexpired). */
  async has(key: string) {
    const fk = this._key(key);
    if (this.hot && this.hot.get(fk) !== undefined) return true;
    const coll = await mongo.getCollection();
    if (!coll) return false;
    try {
      const doc = await coll.findOne(
        { _id: fk, exp: { $gt: new Date() } },
        { projection: { _id: 1 } },
      );
      return Boolean(doc);
    } catch (_: any) {
      return false;
    }
  }

  /**
   * Batched existence check. Returns a boolean array aligned to `keys`. Hot-layer
   * positives short-circuit; the rest resolve in a single projected Mongo query.
   */
  async hasMany(keys: string[]) {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    const fks = keys.map((k) => this._key(k));
    const found = new Set();
    const missKeys: any[] = [];
    for (const fk of fks) {
      if (this.hot && this.hot.get(fk) !== undefined) { found.add(fk); continue; }
      missKeys.push(fk);
    }
    if (missKeys.length) {
      const coll = await mongo.getCollection();
      if (coll) {
        try {
          const docs = await coll.find(
            { _id: { $in: missKeys }, exp: { $gt: new Date() } },
            { projection: { _id: 1 } },
          ).toArray();
          for (const d of docs) found.add(d._id);
        } catch (_: any) { /* treat as not-found */ }
      }
    }
    return fks.map((fk) => found.has(fk));
  }

  /** Delete a key. */
  async delete(key: string) {
    const fk = this._key(key);
    if (this.hot) this.hot.delete(fk);
    const coll = await mongo.getCollection();
    if (!coll) return;
    try {
      await coll.deleteOne({ _id: fk });
    } catch (_: any) {}
  }

  /**
   * Scan keys in this namespace matching `subPattern` (a glob relative to the
   * prefix, e.g. "pr:*"). Returns un-prefixed keys, capped at `limit`. The
   * generated regex is left-anchored on the full prefix so MongoDB can serve it
   * from the `_id` index rather than scanning the collection.
   */
  async keys(subPattern = '*', limit = 1000) {
    const coll = await mongo.getCollection();
    if (!coll) return [];
    const re = globToRegExp(`${this.prefix}${subPattern}`);
    try {
      const docs = await coll.find(
        { _id: re, exp: { $gt: new Date() } },
        { projection: { _id: 1 } },
      ).limit(limit).toArray();
      return docs.map((d: any) => String(d._id).slice(this.prefix.length));
    } catch (_: any) {
      return [];
    }
  }
}

/**
 * Translate a Redis-style glob ("prefix:pr:*") into a left-anchored RegExp.
 * `*` → ".*", `?` → ".", everything else is regex-escaped. Anchoring at ^ keeps
 * the common prefix queries index-friendly.
 */
function globToRegExp(glob: string) {
  let out = '^';
  for (const ch of glob) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out);
}

export { MongoCache, globToRegExp };
