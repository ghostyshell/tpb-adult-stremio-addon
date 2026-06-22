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

export async function fetchCam(username: string): Promise<CamData | null> {
  const res = await fetch(STRIPCHAT_API + '/username/' + encodeURIComponent(username) + '/cam', {
    headers: { 'User-Agent': UA, 'Referer': STRIPCHAT_API + '/', 'Accept': 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const user = data.user || data;
  return {
    streamName: String(user.streamName || ''),
    isCamActive: !!user.isCamActive,
    isLive: !!user.isLive,
    status: String(user.status || ''),
  };
}

export function isPublicLive(cam: CamData): boolean {
  return !!(cam.isLive || cam.isCamActive || cam.status === 'public');
}

export function isAdvertPlaylist(body: string): boolean {
  return body.includes('#EXT-X-MOUFLON-ADVERT');
}

export async function fetchWithPkey(url: string, pkey: string): Promise<Response> {
  const sep = url.includes('?') ? '&' : '?';
  return fetch(url + sep + 'pkey=' + encodeURIComponent(pkey), {
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

  const pkey = await getPkey();
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

export function rewriteM3u8Urls(m3u8: string, baseUrl: string): string {
  const lines = m3u8.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) {
      out.push(line);
      continue;
    }
    let absolute: string;
    try {
      absolute = new URL(trimmed, baseUrl).href;
    } catch {
      out.push(trimmed);
      continue;
    }
    out.push('/stripchat/seg?url=' + encodeURIComponent(absolute));
  }
  return out.join('\n');
}

export async function stripchatStreams(cfg: any, id: string): Promise<any[]> {
  const username = String(id).replace(/^sc:/, '').trim();
  if (!username) return [];

  const cam = await fetchCam(username);
  if (!cam || !cam.streamName || !isPublicLive(cam)) return [];

  const pkey = await getPkey();
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
    name: 'Stripchat ' + v.name,
    description: v.name === variants[0].name ? 'Stripchat Source' : 'Stripchat',
    url: '/stripchat/hls/' + encodeURIComponent(username) + '/' + v.name,
    behaviorHints: { notWebReady: true },
  }));
}
