
/**
 * torrentCache.js
 * Redis-backed store for torrent records and favourites.
 *
 * Torrent records:
 *   Stored via the Redis-backed torrentStore cache (6 h TTL), shared across
 *   restarts and instances.
 *
 * Favourites:
 *   Stored as a Redis hash (field = jstrm ID, value = JSON record).
 *   Hash TTL is extended on every write (default 30 days).
 *   Falls back gracefully when Redis is unavailable.
 */

import type { StoredTorrent } from '../types/debrid';
import { torrentStore } from './cache';
import * as redis from './redis';

const FAV_HASH_KEY = 'favorites:v1';
const FAV_TTL      = 30 * 24 * 60 * 60;      // 30 days

// ── Torrent records ───────────────────────────────────────────────────────────

/**
 * Retrieve a torrent record by jstrm ID. Returns null on miss.
 */
async function getTorrent(id: string): Promise<StoredTorrent | null> {
  return ((await torrentStore.get(id)) as StoredTorrent | undefined) ?? null;
}

/**
 * Store a torrent record. Returns the promise so callers can await it before
 * relying on the record being readable (e.g. before returning a catalog response).
 */
function setTorrent(id: string, record: StoredTorrent): Promise<void> {
  return torrentStore.set(id, record);
}

// ── Favourites ────────────────────────────────────────────────────────────────

/**
 * Return all favourited torrent records as an array.
 */
async function getFavorites() {
  const data = await redis.hgetall(FAV_HASH_KEY);
  if (!data) return [];
  return Object.values(data)
    .map((v) => { try { return JSON.parse(String(v)); } catch (_: any) { return null; } })
    .filter(Boolean);
}

/**
 * Add a torrent record to favourites and refresh the hash TTL.
 */
async function addFavorite(id: string, record: StoredTorrent): Promise<void> {
  await redis.hset(FAV_HASH_KEY, id, JSON.stringify(record));
  await redis.expire(FAV_HASH_KEY, FAV_TTL);
}

/**
 * Remove a torrent record from favourites by jstrm ID.
 */
async function removeFavorite(id: string): Promise<void> {
  await redis.hdel(FAV_HASH_KEY, id);
}

/**
 * Check whether a jstrm ID is in the favourites hash.
 */
async function isFavorite(id: string): Promise<boolean> {
  return (await redis.hget(FAV_HASH_KEY, id)) !== null;
}

export { getTorrent, setTorrent, getFavorites, addFavorite, removeFavorite, isFavorite };
