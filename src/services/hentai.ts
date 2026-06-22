/**
 * hentai.js
 * Thin client for the reference "HentaiStream" Stremio addon (workers.dev).
 *
 * HentaiStream exposes series with episodes whose streams are direct video URLs
 * (no torrents, no debrid, no TPDB). We proxy its catalog/meta/stream endpoints;
 * our routes adapt the results to type 'Porn' - each series becomes one card and
 * its episodes are flattened into the stream list.
 *
 *   GET {BASE}/catalog/hentai/{theirId}[/{extra}].json
 *   GET {BASE}/meta/series/{id}.json            (returns videos[] = episodes)
 *   GET {BASE}/stream/series/{episodeId}.json   (direct video URLs)
 */


import axios from 'axios';
import { hentaiCatalogCache, hentaiDeadCache, hentaiAliveCache } from '../utils/cache';

const BASE = (process.env.HENTAI_URL || 'https://hentaistream-addon.keypop3750.workers.dev').replace(/\/$/, '');
const HTTP_TIMEOUT = 12000;
const HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };

// How many Hentai series to probe in parallel when filtering a catalog page.
const PROBE_CONCURRENCY = Math.max(parseInt(process.env.HENTAI_PROBE_CONCURRENCY || '', 10) || 5, 1);
// Per-item timeout when probing upstream streams. Short enough to keep catalog
// latency acceptable; slow items are kept (fail-open) rather than dropped.
const PROBE_TIMEOUT_MS = Math.max(parseInt(process.env.HENTAI_PROBE_TIMEOUT_MS || '', 10) || 4000, 1000);

// Upstream stream sources to drop entirely (case-insensitive substring match
// against the stream's name/title/url). HentaiSea's CDN frequently serves broken
// placeholder files (a few hundred KB / ~5s clips), so we exclude it and keep
// HentaiMama and any other source. Override via env (comma-separated) if needed.
const EXCLUDED_SOURCES = (process.env.HENTAI_EXCLUDED_SOURCES || 'hentaisea')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** True when a stream belongs to an excluded source (e.g. HentaiSea). */
function isExcludedStream(st: any) {
  if (!st) return true;
  const hay = `${st.name || ''} ${st.title || ''} ${st.url || ''}`.toLowerCase();
  return EXCLUDED_SOURCES.some((s) => hay.includes(s));
}

/**
 * Verify a cover URL actually resolves to an image. Some upstream hosts (e.g.
 * hentai.tv) return an HTML page instead of the image, so the poster string is
 * present but the cover is broken. Returns true (image), false (confirmed
 * non-image or error status), or undefined (inconclusive - network
 * error/timeout - so callers can fail open). Only response headers are read;
 * the body is discarded so a broken HTML cover isn't downloaded.
 */
async function coverIsImage(url: string) {
  if (!url) return false;
  try {
    const res = await axios.get(url, {
      timeout: PROBE_TIMEOUT_MS,
      responseType: 'stream',
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*', Range: 'bytes=0-0' },
    });
    const ct = String(res.headers['content-type'] || '').toLowerCase();
    if (res.data && typeof res.data.destroy === 'function') res.data.destroy();
    if (res.status < 200 || res.status >= 300) return false;
    return ct.startsWith('image/');
  } catch (_: any) {
    return undefined;
  }
}

/** Stremio extra segment: "key=value&key2=value2" (single URL path segment). */
function extraSegment({ genre, search, skip }: any = {}) {
  const parts: any[] = [];
  if (genre && genre !== 'All') parts.push(`genre=${encodeURIComponent(genre)}`);
  if (search) parts.push(`search=${encodeURIComponent(search)}`);
  if (skip) parts.push(`skip=${parseInt(skip) || 0}`);
  return parts.length ? `/${parts.join('&')}` : '';
}

async function getCatalog(theirId: string, opts: any = {}) {
  const cacheKey = `${theirId}|${opts.genre || ''}|${opts.search || ''}|${opts.skip || 0}`;
  const cached = await hentaiCatalogCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = `${BASE}/catalog/hentai/${encodeURIComponent(theirId)}${extraSegment(opts)}.json`;
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT, headers: HEADERS });
    const metas = Array.isArray(res.data && res.data.metas) ? res.data.metas : [];
    await hentaiCatalogCache.set(cacheKey, metas);
    return metas;
  } catch (err: any) {
    return [];
  }
}

async function getMeta(id: string) {
  const url = `${BASE}/meta/series/${encodeURIComponent(id)}.json`;
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT, headers: HEADERS });
    return (res.data && res.data.meta) || null;
  } catch (err: any) {
    return null;
  }
}

async function getEpisodeStreams(episodeId: string) {
  const url = `${BASE}/stream/series/${encodeURIComponent(episodeId)}.json`;
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT, headers: HEADERS });
    const streams = Array.isArray(res.data && res.data.streams) ? res.data.streams : [];
    // Drop excluded sources (HentaiSea) so only reliable sources remain. Applied
    // here so both stream resolution and the catalog alive/dead probe agree.
    return streams.filter((st: any) => !isExcludedStream(st));
  } catch (err: any) {
    return [];
  }
}

/**
 * Filter a Hentai catalog list, dropping items that have no cover art and no
 * upstream video streams. We cache the probe result so repeated catalog loads
 * don't re-hit the upstream stream endpoint for every title.
 *
 * A series is kept when:
 *   - it has a non-empty poster or background, and
 *   - its first episode has at least one stream URL.
 *
 * Probes run with limited concurrency and a short timeout. On timeout/error we
 * keep the item (fail-open) so transient upstream slowness doesn't erase titles.
 */
async function filterCatalogMetas(metas: any[]) {
  if (!Array.isArray(metas) || metas.length === 0) return metas;

  // First, drop obviously broken items with no cover image at all.
  const withCover = metas.filter((m) => m && (m.poster || m.background));
  if (withCover.length === 0) return [];

  // Check cached alive/dead state in one batch per page.
  const ids = withCover.map((m) => String(m.id || ''));
  const [deadFlags, aliveFlags] = await Promise.all([
    hentaiDeadCache.hasMany(ids),
    hentaiAliveCache.hasMany(ids),
  ]);

  const toProbe: any[] = [];
  const results = new Map();
  for (let i = 0; i < withCover.length; i++) {
    const id = ids[i];
    if (deadFlags[i]) {
      results.set(id, false);
      continue;
    }
    if (aliveFlags[i]) {
      results.set(id, true);
      continue;
    }
    toProbe.push({ id, meta: withCover[i] });
  }

  // Probe uncached items with bounded concurrency.
  if (toProbe.length > 0) {
    const queue = [...toProbe];
    const active: any[] = [];
    while (queue.length > 0 || active.length > 0) {
      while (active.length < PROBE_CONCURRENCY && queue.length > 0) {
        const { id, meta } = queue.shift();
        const promise = probeHasStreams(id, meta).then((ok) => {
          results.set(id, ok);
          return ok;
        });
        active.push(promise);
      }
      if (active.length > 0) {
        await Promise.race(active);
        // Remove the first settled promise; index lookup is safe because
        // Promise.race returns as soon as any promise settles.
        active.splice(0, 1);
      }
    }
  }

  return withCover.filter((m) => results.get(String(m.id)) !== false);
}

async function probeHasStreams(seriesId: string, meta: any) {
  // We already filtered out items with no cover in filterCatalogMetas, but the
  // cover check is also enforced here for any direct callers.
  if (!meta || (!meta.poster && !meta.background)) return false;

  // Drop entries whose cover URL is present but doesn't resolve to an image
  // (e.g. hentai.tv serves an HTML page). Inconclusive results (network
  // error/timeout) fail open so transient issues don't erase good titles.
  const coverOk = await coverIsImage(meta.poster || meta.background);
  if (coverOk === false) {
    await hentaiDeadCache.set(seriesId, true);
    return false;
  }

  // Resolve the upstream series id (strip our "hs:" prefix if present).
  const upstreamId = String(seriesId).startsWith('hs:') ? seriesId.slice(3) : seriesId;

  let videos: any[] = [];
  if (meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
    videos = meta.videos;
  } else {
    // Catalog items don't include videos; fetch the series meta once.
    const seriesMeta = await withTimeout(getMeta(upstreamId), PROBE_TIMEOUT_MS);
    if (!seriesMeta) return false;
    videos = seriesMeta.videos && Array.isArray(seriesMeta.videos) ? seriesMeta.videos : [];
  }

  // Cache key must match the id used by filterCatalogMetas when it calls
  // hasMany (our prefixed series id), so cached probe results are actually hit.
  const cacheKey = seriesId;

  // No episodes listed means there are no streams to serve.
  if (videos.length === 0) {
    await hentaiDeadCache.set(cacheKey, true);
    return false;
  }

  // Probe the first episode's stream list. If it has a URL the series is alive.
  const firstEpisodeId = videos[0].id || upstreamId;
  const streams = await withTimeout(
    getEpisodeStreams(firstEpisodeId).then((s) => s.filter((st: any) => st && st.url)),
    PROBE_TIMEOUT_MS,
  );

  if (streams.length === 0) {
    await hentaiDeadCache.set(cacheKey, true);
    return false;
  }

  await hentaiAliveCache.set(cacheKey, true);
  return true;
}

function withTimeout(promise: Promise<any>, ms: number) {
  const timer = new Promise((resolve) => setTimeout(resolve, ms, undefined));
  const marked: any = promise.then((v: any) => {
    marked.isResolved = true;
    return v;
  }).catch((err: any) => {
    marked.isResolved = true;
    throw err;
  });
  return Promise.race([marked, timer]).catch(() => undefined);
}

export { getCatalog, getMeta, getEpisodeStreams, filterCatalogMetas, };
