import { stripchatVariantCache } from '../utils/cache';
import { getPkey } from './stripchatKeys';

export const STRIPCHAT_API = 'https://stripchat.com';
export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
export const ALLOWED_CDN_RE = /^(edge-hls|media-hls)\.doppiocdn\.(com|org|net|media)$/;

export interface CamData {
  streamName: string;
  isCamActive?: boolean;
  isLive?: boolean;
  status?: string;
}

export interface Variant {
  name: string;
  url: string;
  bandwidth: number;
}

/** Map /api/front/v1/broadcasts/{user} item JSON to CamData. */
export function parseBroadcastItem(item: Record<string, unknown> | null | undefined): CamData | null {
  if (!item) return null;
  const streamName = String(item.streamName || '');
  if (!streamName) return null;
  return {
    streamName,
    isCamActive: !!item.isCamActive,
    isLive: !!item.isLive,
    status: String(item.status || ''),
  };
}

export async function fetchCam(username: string): Promise<CamData | null> {
  const res = await fetch(STRIPCHAT_API + '/api/front/v1/broadcasts/' + encodeURIComponent(username), {
    headers: {
      'User-Agent': UA,
      'Referer': STRIPCHAT_API + '/' + encodeURIComponent(username),
      'Accept': 'application/json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json() as { item?: Record<string, unknown> };
  return parseBroadcastItem(data.item || data);
}

export function isPublicLive(cam: CamData): boolean {
  return !!(cam.isLive || cam.isCamActive || cam.status === 'public');
}

export function isAdvertPlaylist(body: string): boolean {
  return body.includes('#EXT-X-MOUFLON-ADVERT');
}

/** Append Stripchat psch=v2 + pkey query params when the CDN URL lacks them. */
export function withPkeyParams(url: string, pkey: string): string {
  if (/[?&]pkey=/.test(url)) {
    if (/[?&]psch=/.test(url)) return url;
    return url + (url.includes('?') ? '&' : '?') + 'psch=v2';
  }
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'psch=v2&pkey=' + encodeURIComponent(pkey);
}

export async function fetchWithPkey(url: string, pkey: string): Promise<Response> {
  return fetch(withPkeyParams(url, pkey), {
    headers: { 'User-Agent': UA, 'Referer': STRIPCHAT_API + '/', 'Origin': STRIPCHAT_API },
  });
}

export async function getMaster(username: string, streamName: string, pkey: string): Promise<{ res: Response; body: string; stale: boolean } | null> {
  const masterUrl = 'https://edge-hls.doppiocdn.com/hls/' + encodeURIComponent(streamName) + '/master/' + encodeURIComponent(streamName) + '_auto.m3u8';
  const res = await fetchWithPkey(masterUrl, pkey);
  if (!res.ok) return null;
  const body = await res.text();
  return { res, body, stale: isAdvertPlaylist(body) };
}

export function parseVariants(m3u8: string): Variant[] {
  const lines = m3u8.split('\n');
  const variants: Variant[] = [];
  let currentInf: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
      currentInf = trimmed;
    } else if (currentInf && trimmed && !trimmed.startsWith('#')) {
      const bwMatch = currentInf.match(/BANDWIDTH=(\d+)/);
      const nameMatch = currentInf.match(/RESOLUTION=(\d+x\d+)/);
      const name = nameMatch ? nameMatch[1] : 'auto';
      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      variants.push({ name, url: trimmed, bandwidth });
      currentInf = null;
    }
  }
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return variants;
}

export async function getVariants(username: string, streamName: string): Promise<Variant[]> {
  const cacheKey = username + '|' + streamName;
  const cached: any = await stripchatVariantCache.get(cacheKey);
  if (cached && Array.isArray(cached)) return cached as Variant[];

  const pkey = await getPkey(streamName);
  if (!pkey) return [];

  const masterUrl = 'https://edge-hls.doppiocdn.com/hls/' + encodeURIComponent(streamName) + '/master/' + encodeURIComponent(streamName) + '_auto.m3u8';
  const res = await fetchWithPkey(masterUrl, pkey);
  if (!res.ok) return [];
  const body = await res.text();
  if (isAdvertPlaylist(body)) return [];

  const variants = parseVariants(body);
  if (variants.length > 0) {
    await stripchatVariantCache.set(cacheKey, variants);
  }
  return variants;
}

/** Human label for a RESOLUTION= value (e.g. 1920x1080 -> 1080p). */
export function variantLabel(resolution: string): string {
  const m = resolution.match(/^(\d+)x(\d+)$/);
  if (!m) return resolution === 'auto' ? 'Auto' : resolution;
  const short = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
  if (short >= 1080) return '1080p';
  if (short >= 720) return '720p';
  if (short >= 480) return '480p';
  if (short >= 240) return '240p';
  return resolution;
}

function variantDescription(v: Variant): string {
  const parts = [v.name];
  if (v.bandwidth > 0) parts.push('~' + Math.round(v.bandwidth / 1e6) + ' Mbps');
  return parts.join(' · ');
}

/** Resolve relative segment/init URLs to absolute CDN URLs (no byte proxy). */
export function rewriteM3u8Urls(m3u8: string, baseUrl: string): string {
  const lines = m3u8.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#EXT-X-MAP:')) {
      const mapMatch = trimmed.match(/URI="([^"]+)"/);
      if (mapMatch) {
        try {
          const absolute = new URL(mapMatch[1], baseUrl).href;
          out.push(trimmed.replace(mapMatch[1], absolute));
          continue;
        } catch { /* fall through */ }
      }
    }
    if (trimmed.startsWith('#') || !trimmed) {
      out.push(line);
      continue;
    }
    try {
      out.push(new URL(trimmed, baseUrl).href);
    } catch {
      out.push(trimmed);
    }
  }
  return out.join('\n');
}

export function stripchatStreamPath(username: string, quality: string): string {
  return '/stripchat/hls/' + encodeURIComponent(username) + '/' + quality;
}

export function stripchatAbsStreamUrl(baseUrl: string, username: string, quality: string): string {
  const base = String(baseUrl || '').replace(/\/$/, '');
  return base + stripchatStreamPath(username, quality);
}

export async function stripchatStreams(cfg: any, id: string, baseUrl = ''): Promise<any[]> {
  const username = String(id).replace(/^sc:/, '').trim();
  if (!username) return [];

  const cam = await fetchCam(username);
  if (!cam || !cam.streamName || !isPublicLive(cam)) return [];

  const pkey = await getPkey(cam.streamName);
  if (!pkey) {
    return [{
      name: 'Stripchat',
      description: 'Key extraction failed, retry later',
      url: '',
      behaviorHints: { notWebReady: true },
    }];
  }

  const result = await getMaster(username, cam.streamName, pkey);
  if (!result) return [];

  if (result.stale) {
    return [{
      name: 'Stripchat',
      description: 'Key extraction failed, retry later',
      url: '',
      behaviorHints: { notWebReady: true },
    }];
  }

  const variants = parseVariants(result.body);
  if (variants.length === 0) return [];

  return variants.map((v) => ({
    name: 'Stripchat ' + variantLabel(v.name),
    description: variantDescription(v),
    url: stripchatAbsStreamUrl(baseUrl, username, v.name),
    // The /stripchat/hls proxy serves a standard, MOUFLON-decrypted HLS
    // playlist with direct CDN segments - web-ready, so Stremio plays it in
    // its internal hls.js player (same path as debrid streams). notWebReady:
    // true forced Stremio to external players, of which only MPV worked.
    behaviorHints: { notWebReady: false },
  }));
}
