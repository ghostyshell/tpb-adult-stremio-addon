/**
 * Server-side flash store for POST→redirect data handoff.
 *
 * The install result (installUrl, manifestUrl, names, …) can exceed 4 KB when
 * many studios are selected, breaking the browser's per-cookie size limit.
 * We store the payload here (same Node.js process as the Next.js server) and
 * put only a small UUID token in the cookie.
 */

import { randomUUID } from 'crypto';

interface Entry {
  data: unknown;
  expires: number;
}

const TTL_MS = 120_000;
const STORE_KEY = '__tpbFlashStore';

// Bridge the Express (tsx source) and Next.js Server Component (built chunk)
// module instances: both hold their own module-local `Map`, so a plain const
// here would be two disconnected stores and getFlash would always miss.
// globalThis is shared across all modules in the process, so pin the Map there.
function store(): Map<string, Entry> {
  const g = globalThis as unknown as { [k: string]: Map<string, Entry> | undefined };
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map();
  return g[STORE_KEY]!;
}

export function setFlash(data: unknown): string {
  const id = randomUUID();
  store().set(id, { data, expires: Date.now() + TTL_MS });
  return id;
}

export function getFlash(id: string): unknown | null {
  const s = store();
  const entry = s.get(id);
  s.delete(id);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.data;
}
