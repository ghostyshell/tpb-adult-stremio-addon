import { createHash } from 'crypto';

/**
 * pkey (PSCH tag) -> pdkey (segment URI decryption).
 * Loaded from PD_KEY_* env as `pkey:pdkey`.
 *
 * MOUFLON v2 key pairs and decode algorithm (community reverse-engineering):
 * - https://github.com/lossless1024/StreaMonitor (stripchat_mouflon_keys.json)
 * - https://github.com/lossless1024/StreaMonitor/issues/310 (v2 URI decrypt steps)
 * - https://github.com/lossless1024/StreaMonitor/issues/261 (Zeechoej4aleeshi key)
 * - https://github.com/HeapOfChaos/goondvr (Go MOUFLON v2 impl)
 */
let pdkeysCache: Record<string, string> | null = null;

function loadStripchatPdkeysFromEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith('PD_KEY_') || !val) continue;
    const colon = val.indexOf(':');
    if (colon <= 0) continue;
    const pkey = val.slice(0, colon).trim();
    const pdkey = val.slice(colon + 1).trim();
    if (pkey && pdkey) out[pkey] = pdkey;
  }
  return out;
}

export function getStripchatPdkeys(): Record<string, string> {
  if (!pdkeysCache) pdkeysCache = loadStripchatPdkeysFromEnv();
  return pdkeysCache;
}

/** Test hook: re-read PD_KEY_* after env changes. */
export function resetStripchatPdkeysCache(): void {
  pdkeysCache = null;
}

const TOKEN_RE = /_(\d+)_([^_]+)_(\d+)/;
const PSCH_V2_RE = /#EXT-X-MOUFLON:PSCH:v2:([A-Za-z0-9]+)/g;

function padBase64(s: string): string {
  switch (s.length % 4) {
    case 2: return s + '==';
    case 3: return s + '=';
    default: return s;
  }
}

function isPrintableAscii(buf: Buffer): boolean {
  if (!buf.length) return false;
  for (const c of buf) if (c < 0x20 || c > 0x7e) return false;
  return true;
}

function decryptToken(uri: string, pdkey: string): Buffer | null {
  const m = uri.match(TOKEN_RE);
  if (!m) return null;
  const encryptedPart = m[2];
  const reversed = encryptedPart.split('').reverse().join('');
  let decoded: Buffer;
  try {
    decoded = Buffer.from(padBase64(reversed), 'base64');
  } catch {
    try {
      decoded = Buffer.from(padBase64(reversed), 'base64url');
    } catch {
      return null;
    }
  }
  const hash = createHash('sha256').update(pdkey).digest();
  const out = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) out[i] = decoded[i] ^ hash[i % 32];
  return out;
}

export function decryptMouflonUri(uri: string, pdkey: string): string | null {
  const m = uri.match(TOKEN_RE);
  if (!m) return uri;
  const result = decryptToken(uri, pdkey);
  if (!result || !isPrintableAscii(result)) return null;
  return uri.replace(m[2], result.toString('utf8'));
}

export function pickStripchatPkey(m3u8: string): string | null {
  const found: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(PSCH_V2_RE.source, 'g');
  while ((match = re.exec(m3u8)) !== null) found.push(match[1]);
  if (!found.length) return null;
  const pdkeys = getStripchatPdkeys();
  for (const pkey of found) {
    if (pdkeys[pkey]) return pkey;
  }
  return found[0];
}

export function resolveStripchatPdkey(pkey: string | null | undefined): string | null {
  if (!pkey) return null;
  return getStripchatPdkeys()[pkey] || null;
}

/** Rewrite MOUFLON media playlists into plain segment URLs Stremio can fetch. */
export function decodeMouflonPlaylist(m3u8: string, pdkey: string | null): string {
  if (!m3u8.includes('#EXT-X-MOUFLON:URI:') || !pdkey) return m3u8;

  const lines = m3u8.split('\n');
  const out: string[] = [];
  let pendingUri = '';

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('#EXT-X-MOUFLON:URI:')) {
      let uri = trimmed.slice('#EXT-X-MOUFLON:URI:'.length);
      const decrypted = decryptMouflonUri(uri, pdkey);
      pendingUri = decrypted || uri;
      continue;
    }
    if (pendingUri && trimmed && !trimmed.startsWith('#')) {
      out.push(pendingUri);
      pendingUri = '';
      continue;
    }
    if (trimmed.startsWith('#EXT-X-MOUFLON:PSCH:')) continue;
    out.push(trimmed);
  }
  return out.join('\n');
}

export function normalizeStripchatM3u8(m3u8: string): string {
  const stripPrefixes = [
    '#EXT-X-PART:',
    '#EXT-X-PART-INF:',
    '#EXT-X-PRELOAD-HINT:',
    '#EXT-X-SERVER-CONTROL:',
    '#EXT-X-RENDITION-REPORT:',
  ];
  const out: string[] = [];
  for (const line of m3u8.split('\n')) {
    const trimmed = line.trimEnd();
    if (stripPrefixes.some((p) => trimmed.startsWith(p))) continue;
    if (trimmed.startsWith('#EXTINF:') && !trimmed.endsWith(',')) {
      out.push(trimmed + ',');
      continue;
    }
    out.push(trimmed);
  }
  return out.join('\n');
}
