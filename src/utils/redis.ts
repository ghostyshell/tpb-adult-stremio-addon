import Redis from 'ioredis';

// Redis client - optional. Set REDIS_URL to enable.
// All operations degrade gracefully to no-ops when Redis is unavailable.

let client: Redis | null = null;

if (process.env.REDIS_URL) {
  const opts: any = {
    enableOfflineQueue: false, // fail fast when disconnected; don't queue commands
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  };
  // REDIS_PASSWORD overrides any password already embedded in REDIS_URL
  if (process.env.REDIS_PASSWORD) opts.password = process.env.REDIS_PASSWORD;
  client = new Redis(process.env.REDIS_URL, opts);
  client.on('connect', () => console.log('[redis] connected'));
  client.on('error',   (e: Error) => console.warn('[redis] error:', e.message));
}

/**
 * Get a string value. Returns null on miss or error.
 */
async function get(key: string) {
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (_: any) {
    return null;
  }
}

/**
 * Pipelined multi-get. Returns an array of raw string values aligned to `keys`
 * (null for a missing key). One round trip instead of one per key - used by the
 * background warmers to read large key batches without flooding Redis.
 */
async function mget(keys: string[]) {
  if (!client || !Array.isArray(keys) || keys.length === 0) {
    return Array.isArray(keys) ? keys.map(() => null) : [];
  }
  try {
    const vals = await client.mget(keys);
    return Array.isArray(vals) ? vals : keys.map(() => null);
  } catch (_: any) {
    return keys.map(() => null);
  }
}

/**
 * Pipelined existence check. Returns a boolean array aligned to `keys`. Uses a
 * single pipelined EXISTS per key (one round trip) rather than N separate
 * commands - far cheaper than fetching values when only presence matters.
 */
async function existsMany(keys: string[]) {
  if (!client || !Array.isArray(keys) || keys.length === 0) {
    return Array.isArray(keys) ? keys.map(() => false) : [];
  }
  try {
    const pipe = client.pipeline();
    for (const k of keys) pipe.exists(k);
    const res = await pipe.exec();
    // pipeline.exec() → [[err, reply], …] in input order.
    return keys.map((_, i) => {
      const entry = res && res[i];
      return Boolean(entry && !entry[0] && entry[1] === 1);
    });
  } catch (_: any) {
    return keys.map(() => false);
  }
}

/**
 * Set a string value with a TTL in seconds. Fire-and-forget safe (errors swallowed).
 */
async function set(key: string, value: string, ttlSeconds: number) {
  if (!client) return;
  try {
    await client.set(key, value, 'EX', ttlSeconds);
  } catch (_: any) {}
}

/**
 * Get a single field from a Redis hash. Returns null on miss or error.
 */
async function hget(key: string, field: string) {
  if (!client) return null;
  try {
    return await client.hget(key, field);
  } catch (_: any) {
    return null;
  }
}

/**
 * Set a single field in a Redis hash. Fire-and-forget safe.
 */
async function hset(key: string, field: string, value: string) {
  if (!client) return;
  try {
    await client.hset(key, field, value);
  } catch (_: any) {}
}

/**
 * Get all fields and values from a Redis hash. Returns null on miss or error.
 */
async function hgetall(key: string) {
  if (!client) return null;
  try {
    const data = await client.hgetall(key);
    return data && Object.keys(data).length > 0 ? data : null;
  } catch (_: any) {
    return null;
  }
}

/**
 * Delete a field from a Redis hash. Fire-and-forget safe.
 */
async function hdel(key: string, field: string) {
  if (!client) return;
  try {
    await client.hdel(key, field);
  } catch (_: any) {}
}

/**
 * Update the TTL of an existing key. Fire-and-forget safe.
 */
async function expire(key: string, ttlSeconds: number) {
  if (!client) return;
  try {
    await client.expire(key, ttlSeconds);
  } catch (_: any) {}
}

/**
 * Delete a key. Fire-and-forget safe.
 */
async function del(key: string) {
  if (!client) return;
  try {
    await client.del(key);
  } catch (_: any) {}
}

/**
 * Whether a key exists. Returns false on miss or error.
 */
async function exists(key: string) {
  if (!client) return false;
  try {
    return (await client.exists(key)) === 1;
  } catch (_: any) {
    return false;
  }
}

/**
 * Non-blocking cursor scan for keys matching a glob pattern. Returns at most
 * `limit` keys. Uses SCAN (never KEYS) so it's safe on a live server.
 */
async function scan(pattern: string, limit = 1000) {
  if (!client) return [];
  const found: any[] = [];
  let cursor = '0';
  try {
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
      cursor = next;
      if (Array.isArray(batch)) {
        for (const k of batch) {
          found.push(k);
          if (found.length >= limit) return found;
        }
      }
    } while (cursor !== '0');
  } catch (_: any) {}
  return found;
}

export { get, mget, set, hget, hset, hgetall, hdel, expire, del, exists, existsMany, scan, client };
