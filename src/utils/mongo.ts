
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
 *
 * ponytail: connect lazily on first use so MONGODB_DB / credentials read at
 * request time, not module import (avoids empty profile lists after deploy).
 */

import { MongoClient, type Collection } from 'mongodb';

/** Shared `cache` collection document shape (_id is a prefixed string key, not ObjectId). */
export interface MongoCacheDoc {
  _id: string;
  v: string;
  exp: Date;
}

export type MongoCacheCollection = Collection<MongoCacheDoc>;

let client: MongoClient | null = null;
let ready: Promise<MongoCacheCollection | null> | null = null;

function mongoUri(): string {
  return process.env.MONGODB_URI || process.env.MONGO_URL || '';
}

function dbName(): string {
  return process.env.MONGODB_DB || process.env.MONGO_DB || 'tpb_addon';
}

function collName(): string {
  return process.env.MONGO_COLLECTION || 'cache';
}

function clientOpts(): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    maxPoolSize:               parseInt(process.env.MONGO_POOL_SIZE || '', 10) || 10,
    serverSelectionTimeoutMS:  parseInt(process.env.MONGO_TIMEOUT_MS || '', 10) || 5000,
    socketTimeoutMS:           parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '', 10) || 20000,
  };
  if (process.env.MONGO_USERNAME || process.env.MONGO_PASSWORD) {
    opts.auth = {
      username: process.env.MONGO_USERNAME || '',
      password: process.env.MONGO_PASSWORD || '',
    };
    opts.authSource = process.env.MONGO_AUTH_SOURCE || 'admin';
  }
  return opts;
}

function resetClient(): void {
  ready = null;
  const c = client;
  client = null;
  if (c) c.close().catch(() => {});
}

function connect(): Promise<MongoCacheCollection | null> {
  const uri = mongoUri();
  if (!uri) return Promise.resolve(null);
  if (!ready) {
    client = new MongoClient(uri, clientOpts() as ConstructorParameters<typeof MongoClient>[1]);
    client.on('error', (e: Error) => console.warn('[mongo] client error:', e.message));
    ready = client.connect()
      .then(async () => {
        const collection = client!.db(dbName()).collection<MongoCacheDoc>(collName());
        await collection.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }).catch((e: Error) => {
          console.warn('[mongo] TTL index create failed:', e.message);
        });
        console.log(`[mongo] connected (db=${dbName()}, collection=${collName()})`);
        return collection;
      })
      .catch((e: Error) => {
        console.warn('[mongo] connection failed - persistent caches will miss:', e.message);
        resetClient();
        return null;
      });
  }
  return ready;
}

/** Resolve the shared cache collection, or null when Mongo is unconfigured / unavailable. */
async function getCollection(): Promise<MongoCacheCollection | null> {
  try {
    const coll = await connect();
    if (coll) return coll;
    resetClient();
    return await connect();
  } catch {
    return null;
  }
}

function isEnabled(): boolean {
  return Boolean(mongoUri());
}

async function close(): Promise<void> {
  resetClient();
}

export { getCollection, isEnabled, close, dbName, collName };
