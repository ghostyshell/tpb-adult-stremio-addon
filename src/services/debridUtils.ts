// Shared debrid-service plumbing, extracted as a structure-preserving
// refactor (no behaviour change). Each helper here was duplicated verbatim
// across the per-provider service files; the divergent copies
// (Real-Debrid's IP-scoped key, debridlink/torbox's {torrentId,files} cache
// entries) are left local to their services.

import { createHash } from 'crypto';

/** Video file extension matcher shared across debrid services. */
export const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

/**
 * 16-char sha1 cache-key namespacer. Hashes the secret so the raw API key
 * never appears in a cache key. Identical across every debrid service except
 * Real-Debrid, which also mixes in the user IP and so keeps its own copy.
 */
export function scopeKey(secret: string): string {
  return createHash('sha1').update(String(secret || '')).digest('hex').slice(0, 16);
}

/** Structural shape of the shared stream cache (see src/utils/cache.ts). */
interface CacheLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/**
 * Get-or-resolve-then-set. On a hit the cached value is returned as-is; on a
 * miss `fn` runs and its result is cached (the cache's default TTL) and
 * returned. If `fn` throws, nothing is cached - matching the inline pattern
 * each service had. `if (cached)` preserves the original truthiness guard
 * (a cached value is always present or undefined; empty arrays are never
 * stored because the services throw before set on empty).
 */
export async function cachedResolve<T>(cache: CacheLike, key: string, fn: () => Promise<T>): Promise<T> {
  const cached = await cache.get(key) as T | undefined;
  if (cached) return cached;
  const value = await fn();
  await cache.set(key, value);
  return value;
}