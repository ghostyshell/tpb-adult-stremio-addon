import { stripchatKeyCache } from '../utils/cache';
import { pickStripchatPkey } from './stripchatMouflon';
import { STRIPCHAT_API, UA } from './stripchatHls';

const PKEY_CACHE_KEY = 'stripchat:pkey:v2';

interface PkeyResult {
  pkey: string;
}

/** Read a v2 pkey we can decrypt (prefers known pkey/pdkey pairs). */
export function parsePkeyFromMaster(m3u8: string): string | null {
  return pickStripchatPkey(m3u8);
}

async function extractPkeyFromMaster(streamName: string): Promise<string | null> {
  const masterUrl = 'https://edge-hls.doppiocdn.com/hls/'
    + encodeURIComponent(streamName) + '/master/'
    + encodeURIComponent(streamName) + '_auto.m3u8';
  const res = await fetch(masterUrl, {
    headers: { 'User-Agent': UA, 'Referer': STRIPCHAT_API + '/', 'Origin': STRIPCHAT_API },
  });
  if (!res.ok) return null;
  return parsePkeyFromMaster(await res.text());
}

async function extractPkey(streamName?: string): Promise<string | null> {
  if (streamName) {
    const pk = await extractPkeyFromMaster(streamName);
    if (pk) {
      console.log('[stripchatKeys] pkey from master m3u8 (stream ' + streamName + ')');
      return pk;
    }
  }
  return null;
}

async function getPkey(streamName?: string): Promise<string | null> {
  const cached: any = await stripchatKeyCache.get(PKEY_CACHE_KEY);
  if (cached && cached.pkey) return cached.pkey;

  const pkey = await extractPkey(streamName);
  if (pkey) {
    await stripchatKeyCache.set(PKEY_CACHE_KEY, { pkey } as PkeyResult);
  }
  return pkey;
}

async function invalidatePkey(): Promise<void> {
  await stripchatKeyCache.delete(PKEY_CACHE_KEY);
}

async function refreshPkey(streamName?: string): Promise<string | null> {
  await invalidatePkey();
  const pkey = await extractPkey(streamName);
  if (pkey) {
    await stripchatKeyCache.set(PKEY_CACHE_KEY, { pkey } as PkeyResult);
  }
  return pkey;
}

export { getPkey, extractPkey, invalidatePkey, refreshPkey };
