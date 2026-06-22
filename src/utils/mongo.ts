
/**
 * mongo.js
 * Optional MongoDB client. Set MONGODB_URI to enable.
 *
 * Purpose: offload the large, long-lived "persistent metadata store" caches
 * (tpdb/stashdb shared stores, reference meta, resolved magnets, stash tags)
 * off Redis and into MongoDB, which is far cheaper per-GB for data that is
 * keyed-lookup only, grows steadily over a 30-day TTL, and never needs Redis's
 * in-memory speed. See utils/cache.js for which caches are routed here.
 *
 * All cache documents live in a SINGLE collection (default `cache`):
 *   { _id: "<prefixed key>", v: "<JSON string>", exp: <Date> }
 * A TTL index on `exp` lets MongoDB expire entries the same way Redis EX does.
 * The `_id` index (automatic) serves point lookups and left-anchaged prefix
 * scans (used by RedisCache-compatible keys()).
 *
 * Every accessor degrades gracefully: when MONGODB_URI is unset, or the
 * connection is unavailable, getCollection() resolves to null and the
 * MongoCache methods become misses / no-ops - exactly like redis.js does.
 */

import { MongoClient } from 'mongodb';

// Connection config. The host URI and credentials are supplied separately so
// the password never has to be URL-encoded into the URI (mirrors how
// REDIS_PASSWORD overrides any password embedded in REDIS_URL). MONGODB_* are
// the canonical names; MONGO_URL / MONGO_DB are accepted as fallbacks.
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL || '';
const DB_NAME   = process.env.MONGODB_DB  || process.env.MONGO_DB  || 'tpb_addon';
const COLL_NAME = process.env.MONGO_COLLECTION || 'cache';

let client: any = null;
let ready: any = null;   // Promise<Collection|null>, resolved once after connect

if (MONGO_URI) {
  const opts: any = {
    maxPoolSize:               parseInt(process.env.MONGO_POOL_SIZE || '', 10) || 10,
    serverSelectionTimeoutMS:  parseInt(process.env.MONGO_TIMEOUT_MS || '', 10) || 5000,
    // Keep the app responsive if Mongo is briefly unreachable rather than
    // hanging request-path reads forever.
    socketTimeoutMS:           parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '', 10) || 20000,
  };
  // Credentials as driver options (not string-built into the URI), so special
  // characters in the password need no escaping. authSource defaults to "admin"
  // when the URI carries no database path - which matches an admin user; set
  // MONGO_AUTH_SOURCE to override (e.g. the app DB for a scoped user).
  if (process.env.MONGO_USERNAME || process.env.MONGO_PASSWORD) {
    opts.auth = {
      username: process.env.MONGO_USERNAME || '',
      password: process.env.MONGO_PASSWORD || '',
    };
    opts.authSource = process.env.MONGO_AUTH_SOURCE || 'admin';
  }
  client = new MongoClient(MONGO_URI, opts);
  ready = client.connect()
    .then(async () => {
      const collection = client.db(DB_NAME).collection(COLL_NAME);
      // TTL index - MongoDB removes a doc once `exp` (a Date) passes.
      // expireAfterSeconds:0 means "expire at the time stored in the field".
      await collection.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }).catch((e: Error) => {
        console.warn('[mongo] TTL index create failed:', e.message);
      });
      console.log(`[mongo] connected (db=${DB_NAME}, collection=${COLL_NAME})`);
      return collection;
    })
    .catch((e: Error) => {
      console.warn('[mongo] connection failed - persistent caches will miss:', e.message);
      return null;
    });

  // Surface late connection drops without crashing the process.
  client.on('error', (e: Error) => console.warn('[mongo] client error:', e.message));
}

/**
 * Resolve the shared cache collection, or null when Mongo is unconfigured /
 * unavailable. Callers must treat null as "degrade to a miss / no-op".
 */
async function getCollection() {
  if (!ready) return null;
  try {
    return await ready;
  } catch (_: any) {
    return null;
  }
}

/** Whether a Mongo connection URI is configured (the cache factory keys off this). */
function isEnabled() {
  return Boolean(MONGO_URI);
}

/** Close the client (graceful shutdown). Safe to call when disabled. */
async function close() {
  if (!client) return;
  try {
    await client.close();
  } catch (_: any) {}
}

export { getCollection, isEnabled, close, DB_NAME, COLL_NAME };
