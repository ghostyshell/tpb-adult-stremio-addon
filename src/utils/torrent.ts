/**
 * torrent.js
 * Utilities for torrent name parsing, ID encoding/decoding, and quality detection.
 *
 * Stremio item IDs used by this addon:
 *   Format:  jstrm:<base64url(JSON)>
 *   JSON:    { h: infoHash, t: title, u: torrentUrl, w: website }
 *
 * The infoHash allows us to rebuild the magnet link at stream-resolve time
 * without needing server-side state beyond what we can derive from the ID.
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { isSafeUrl } from './safeUrl';

// Quality keywords to detect resolution from torrent names
const QUALITY_PATTERNS = {
  '2160p': /\b(2160p|4k|uhd|ultra\.?hd)\b/i,
  '1080p': /\b(1080p|fhd|full\.?hd)\b/i,
  '720p':  /\b(720p|hd)\b/i,
  '480p':  /\b(480p|sd)\b/i,
};

// HDR formats
const HDR_PATTERNS = /\b(hdr10\+?|dolby\.?vision|dv|hlg|hdr)\b/i;

// Codec patterns
const CODEC_PATTERNS = /\b(x265|x264|hevc|avc|av1|xvid|divx)\b/i;

// Source patterns
const SOURCE_PATTERNS = /\b(bluray|blu-ray|bdrip|brrip|web-dl|webrip|dvdrip|hdtv|remux)\b/i;

/**
 * Detect video quality/resolution from a torrent name.
 */
function detectQuality(name: string): string {
  for (const [qual, re] of Object.entries(QUALITY_PATTERNS)) {
    if (re.test(name)) return qual;
  }
  return 'unknown';
}

/**
 * Build a human-readable quality tag string, e.g. "2160p HDR HEVC WEB-DL"
 */
function qualityTag(name: string): string {
  const parts: string[] = [];
  const q = detectQuality(name);
  if (q !== 'unknown') parts.push(q);

  const hdrM = name.match(HDR_PATTERNS);
  if (hdrM) parts.push(hdrM[0].toUpperCase());

  const codecM = name.match(CODEC_PATTERNS);
  if (codecM) parts.push(codecM[0].toUpperCase());

  const srcM = name.match(SOURCE_PATTERNS);
  if (srcM) parts.push(srcM[0].toUpperCase().replace(/-/g, '-'));

  return parts.join(' ') || 'Unknown';
}

/**
 * Extract the clean title and optional year from a torrent name.
 * Strips resolution/quality suffixes.
 *
 * e.g. "Movie.Name.2023.2160p.UHD.BluRay.x265" → { title: "Movie Name", year: "2023" }
 */
function parseTorrentTitle(name: string): { title: string; year: string | null } {
  // Replace dots/underscores used as word separators with spaces
  let cleaned = name.replace(/[._]/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Try to find year pattern YYYY to split title from quality info
  const yearMatch = cleaned.match(/^(.*?)\s+((?:19|20)\d{2})\b/);
  if (yearMatch) {
    return { title: yearMatch[1].trim(), year: yearMatch[2] };
  }

  // Fallback: strip quality keywords
  const qualRe = /\s+(2160p|4k|uhd|1080p|fhd|720p|480p|bluray|blu-ray|bdrip|web-dl|webrip|hdtv|remux|x265|x264|hevc|avc|hdr|dv|dolby).*/i;
  const stripped = cleaned.replace(qualRe, '').trim();
  return { title: stripped || cleaned, year: null };
}

/**
 * Build a deterministic torrent key from website and name (matches Go backend).
 */
function buildTorrentKey(website: string, name: string): string {
  const normalized = name.toLowerCase().replace(/[ /\\:]/g, '-');
  return website ? `${website.toLowerCase()}:${normalized}` : normalized;
}

/**
 * Extract the info-hash (btih) from a magnet URI.
 * Returns lowercase hex string, or null if not found.
 */
function extractInfoHash(magnet: string | null | undefined): string | null {
  if (!magnet) return null;
  const m = magnet.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  if (!m) return null;
  const raw = m[1];
  // Base32 → hex if necessary
  if (raw.length === 32) {
    // regex [a-zA-Z2-7] guarantees all chars are valid base32; catch is unreachable
    /* v8 ignore next 5 */
    try {
      return base32ToHex(raw).toLowerCase();
    } catch (_: any) {
      return raw.toLowerCase();
    }
  }
  return raw.toLowerCase();
}

/**
 * Build a minimal magnet URI from an info-hash and display name.
 */
function buildMagnet(infoHash: string, displayName: string): string {
  const dn = encodeURIComponent(displayName || '');
  return `magnet:?xt=urn:btih:${infoHash}&dn=${dn}`;
}

/**
 * Encode a torrent record into a Stremio-compatible item ID.
 *
 * @param {object} record  - { h: infoHash, t: title, u: torrentUrl, w: website }
 * @returns {string}       - "jstrm:<base64url>"
 */
function encodeItemId(record: Record<string, unknown>): string {
  const payload: Record<string, unknown> = {
    h: record.h || record.infoHash || '',
    t: record.t || record.title || '',
    u: record.u || record.torrentUrl || '',
    w: record.w || record.website || '',
  };
  const detailUrl = record.d || record.detailUrl || '';
  if (detailUrl) payload.d = detailUrl;
  // q (catalog quality scope: '4k' | 'fhd') round-trips so a re-encoded member
  // id matches the Go-encoded one and applyQualityFilter can scope per member.
  const q = record.q || record.quality || '';
  if (q) payload.q = q;
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `jstrm:${b64}`;
}

/**
 * Decode a Stremio item ID back into a record object.
 *
 * @param {string} id  - "jstrm:<base64url>"
 * @returns {object|null}
 */
function decodeItemId(id: string): Record<string, unknown> | null {
  if (!id || !id.startsWith('jstrm:')) return null;
  try {
    const b64 = id.slice('jstrm:'.length);
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (_: any) {
    return null;
  }
}

/**
 * Decode a compact-mode group item ID ("jstrg:<base64url>") into its member
 * records. The Go backend emits one jstrg: id per scene, encoding the 4K and
 * 1080p variants as a JSON array of the same record shape used by jstrm:. The
 * stream route re-encodes each member back to a jstrm: id and resolves it
 * through the normal per-record path, yielding one stream per variant.
 *
 * @param {string} id  - "jstrg:<base64url>"
 * @returns {object[]|null}
 */
function decodeGroupId(id: string): Record<string, unknown>[] | null {
  if (!id || !id.startsWith('jstrg:')) return null;
  try {
    const b64 = id.slice('jstrg:'.length);
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_: any) {
    return null;
  }
}

/**
 * Create a short stable hash for use as a cache key.
 */
function shortHash(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 16);
}

// ── Base32 helper ────────────────────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32ToHex(base32: string): string {
  let bits = 0;
  let value = 0;
  let hex = '';
  const upper = base32.toUpperCase();
  for (const char of upper) {
    const idx = BASE32_ALPHABET.indexOf(char);
    /* v8 ignore next -- unreachable: extractInfoHash regex [a-zA-Z2-7] guarantees valid chars */
    if (idx === -1) throw new Error(`Invalid base32 char: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      hex += ((value >>> (bits - 8)) & 0xff).toString(16).padStart(2, '0');
      bits -= 8;
    }
  }
  return hex;
}

/**
 * Encode a stream URL through MediaFlow Proxy.
 *
 * @param {string} proxyUrl       - MediaFlow Proxy base URL (e.g. http://host:8888)
 * @param {string} destinationUrl - Original stream URL (e.g. Real Debrid CDN URL)
 * @param {string} apiPassword    - MediaFlow Proxy API password
 * @param {object} responseHeaders - Optional response headers to forward
 * @returns {string} - Proxied URL
 */
const MAX_BENCODE_DEPTH = 32;
const MAX_BENCODE_BYTES = 20 * 1024 * 1024;

function skipBencodeValue(buf: Buffer, pos: number, depth = 0): number {
  /* v8 ignore start -- pos<0 and buf.length>MAX_BENCODE_BYTES guards are defensive; unreachable from parseInfoHashFromTorrentBuffer */
  if (depth > MAX_BENCODE_DEPTH || pos < 0 || pos >= buf.length) return buf.length;
  if (buf.length > MAX_BENCODE_BYTES) return buf.length;
  /* v8 ignore stop */
  const c = buf[pos];
  if (c === 0x64) {
    let p = pos + 1;
    while (p < buf.length && buf[p] !== 0x65) {
      p = skipBencodeValue(buf, p, depth + 1);
      if (p >= buf.length) return buf.length;
      p = skipBencodeValue(buf, p, depth + 1);
      if (p >= buf.length) return buf.length;
    }
    return Math.min(p + 1, buf.length);
  }
  if (c === 0x6c) {
    let p = pos + 1;
    while (p < buf.length && buf[p] !== 0x65) {
      p = skipBencodeValue(buf, p, depth + 1);
    }
    return Math.min(p + 1, buf.length);
  }
  if (c === 0x69) {
    const end = buf.indexOf(0x65, pos);
    return end < 0 ? buf.length : end + 1;
  }
  const colon = buf.indexOf(0x3a, pos);
  if (colon < 0) return buf.length;
  const lenStr = buf.slice(pos, colon).toString('ascii');
  if (!/^\d+$/.test(lenStr)) return buf.length;
  const len = parseInt(lenStr, 10);
  if (Number.isNaN(len) || len < 0 || colon + 1 + len > buf.length) return buf.length;
  return colon + 1 + len;
}

/**
 * Extract the info-hash from a raw .torrent file buffer (bencode).
 */
function parseInfoHashFromTorrentBuffer(buf: Buffer): string {
  if (!buf || !buf.length || buf.length > MAX_BENCODE_BYTES) return '';
  const m = buf.toString('binary').match(/(\d+):info/);
  if (!m) return '';
  const key = Buffer.from(m[0]);
  const i = buf.indexOf(key);
  /* v8 ignore next -- regex match guarantees key exists in buf; indexOf cannot return -1 */
  if (i < 0) return '';
  const start = i + key.length;
  if (buf[start] !== 0x64) return '';
  const end = skipBencodeValue(buf, start);
  /* v8 ignore next -- skipBencodeValue always returns start+2..buf.length; both conditions are unreachable */
  if (end <= start || end > buf.length) return '';
  return crypto.createHash('sha1').update(buf.subarray(start, end)).digest('hex');
}

/**
 * Download a .torrent file and return its info-hash.
 */
async function fetchInfoHashFromTorrentUrl(torrentUrl: string, referer: string | undefined): Promise<string> {
  const raw = String(torrentUrl || '').trim();
  if (!raw || !/\.torrent(\?|$)/i.test(raw)) return '';

  const safe = isSafeUrl(raw);
  if (!safe.ok) {
    console.warn(`[torrent] unsafe .torrent URL rejected: ${safe.reason} (${raw.slice(0, 80)})`);
    return '';
  }

  const headers: any = { 'User-Agent': 'stremio-tpb-porn/1.0' };
  if (referer) headers.Referer = referer;
  const res = await axios.get(raw, {
    responseType: 'arraybuffer',
    timeout: 20000,
    headers,
    maxRedirects: 5,
  });
  return parseInfoHashFromTorrentBuffer(Buffer.from(res.data));
}

function isPornripsUrl(url: unknown): boolean {
  return /pornrips\.to/i.test(String(url || ''));
}

/**
 * Extract the PornRips post slug from a detail URL.
 *   https://pornrips.to/some-release-1080p-prt/ → "some-release-1080p-prt"
 * Returns '' when the URL isn't a PornRips post.
 */
function pornripsSlug(detailUrl: unknown): string {
  const m = String(detailUrl || '').match(/pornrips\.to\/([^/?#]+)/i);
  return m ? m[1] : '';
}

/**
 * Stable, cross-install identity for an item's metadata cache.
 * Torrents key on their infoHash; PornRips items (which carry no infoHash at
 * catalog time) key on their post slug instead, so the shared TPDB store and
 * the reference-addon fallback stay populated for keyless installs.
 */
function stableMetaId({ website, detailUrl, infoHash }: any = {}) {
  if (website === 'pornrips') {
    const slug = pornripsSlug(detailUrl);
    return slug ? `pr:${slug}` : '';
  }
  return infoHash || '';
}

function encodeMediaFlowProxyUrl(proxyUrl: string, destinationUrl: string, apiPassword: string, responseHeaders: Record<string, string>): string {
  const params = new URLSearchParams({
    d: destinationUrl,
    api_password: apiPassword,
  });

  // Add response headers with r_ prefix
  if (responseHeaders) {
    Object.entries(responseHeaders).forEach(([key, value]) => {
      params.set(`r_${key}`, value as string);
    });
  }

  const baseUrl = proxyUrl.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}/proxy/stream?${params.toString()}`;
}

export { detectQuality, qualityTag, parseTorrentTitle, buildTorrentKey, extractInfoHash, buildMagnet, encodeItemId, decodeItemId, decodeGroupId, shortHash, parseInfoHashFromTorrentBuffer, fetchInfoHashFromTorrentUrl, isPornripsUrl, pornripsSlug, stableMetaId, encodeMediaFlowProxyUrl, };
