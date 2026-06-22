/**
 * porntube.js
 * Thin client for the reference "Porn Tube" Stremio addon (ptube.ers.pw).
 *
 * PornTube exposes TPDB-enriched movie catalogs whose streams are torrents
 * (infoHash). We proxy its catalog/meta/stream endpoints and our routes adapt
 * the results to type 'Porn' + resolve the infoHash through our debrid pipeline.
 *
 *   GET {BASE}/catalog/movie/{theirId}[/{extra}].json
 *   GET {BASE}/meta/movie/{id}.json
 *   GET {BASE}/stream/movie/{id}.json
 */


import axios from 'axios';
import { porntubeCatalogCache } from '../utils/cache';

const BASE = (process.env.PORNTUBE_URL || 'https://ptube.ers.pw').replace(/\/$/, '');
const HTTP_TIMEOUT = 12000;
const HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' };

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
  const cached = await porntubeCatalogCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = `${BASE}/catalog/movie/${encodeURIComponent(theirId)}${extraSegment(opts)}.json`;
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT, headers: HEADERS });
    const metas = Array.isArray(res.data && res.data.metas) ? res.data.metas : [];
    await porntubeCatalogCache.set(cacheKey, metas);
    return metas;
  } catch (err: any) {
    return [];
  }
}

async function getMeta(id: string) {
  const url = `${BASE}/meta/movie/${encodeURIComponent(id)}.json`;
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT, headers: HEADERS });
    return (res.data && res.data.meta) || null;
  } catch (err: any) {
    return null;
  }
}

async function getStreams(id: string) {
  const url = `${BASE}/stream/movie/${encodeURIComponent(id)}.json`;
  try {
    const res = await axios.get(url, { timeout: HTTP_TIMEOUT, headers: HEADERS });
    return Array.isArray(res.data && res.data.streams) ? res.data.streams : [];
  } catch (err: any) {
    return [];
  }
}

export { getCatalog, getMeta, getStreams };
