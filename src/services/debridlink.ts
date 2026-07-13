/**
 * debridlink.js
 * Debrid-Link API client (v2 seedbox).
 *
 * Flow:
 *   1. POST /api/v2/seedbox/add  { url: <magnet or torrent URL> }
 *   2. Poll GET /api/v2/seedbox/list?ids={torrentId}
 *      until downloadPercent === 100 and files[] is populated
 *   3. Return downloadUrl per file
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, scopeKey } from './debridUtils';

const BASE_URL = 'https://debrid-link.com/api/v2';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

interface DlFile { downloadUrl?: string; name?: string; size?: number }
interface DlCacheEntry { torrentId: string | number; files: DlFile[] }

function dlClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addTorrent(apiKey: string, url: string) {
  const client = dlClient(apiKey);
  const res = await client.post('/seedbox/add', { url, async: false });
  const body = res.data;
  if (!body?.success) {
    throw new Error(`Debrid-Link add failed: ${body?.error || JSON.stringify(body)}`);
  }
  const torrentId = body.value?.id;
  if (!torrentId) throw new Error('Debrid-Link add: no torrent id');
  return torrentId;
}

async function addTorrentFile(apiKey: string, torrentUrl: string) {
  const fileRes = await axios.get(torrentUrl, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    headers: { 'User-Agent': 'stremio-addon/1.0' },
    maxRedirects: 5,
  });

  const form = new FormData();
  const blob = new Blob([fileRes.data], { type: 'application/x-bittorrent' });
  form.append('file', blob, 'torrent.torrent');

  const res = await axios.post(`${BASE_URL}/seedbox/add`, form, {
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = res.data;
  if (!body?.success) {
    throw new Error(`Debrid-Link file add failed: ${body?.error || JSON.stringify(body)}`);
  }
  const torrentId = body.value?.id;
  if (!torrentId) throw new Error('Debrid-Link file add: no torrent id');
  return torrentId;
}

async function getTorrentInfo(apiKey: string, torrentId: string | number) {
  const client = dlClient(apiKey);
  const res = await client.get('/seedbox/list', { params: { ids: String(torrentId) } });
  const list = res.data?.value;
  if (Array.isArray(list) && list.length) return list[0];
  return null;
}

async function waitForReady(apiKey: string, torrentId: string | number) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await getTorrentInfo(apiKey, torrentId);
    if (info && info.downloadPercent === 100 && (info.files || []).length > 0) {
      return info;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Debrid-Link torrent');
}

function buildFileResults(files: DlFile[]) {
  const mapped = (files || [])
    .map((f) => ({
      url: f.downloadUrl || '',
      fileName: f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f) => f.url);

  const video = mapped.filter((f) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function resolveTorrent(apiKey: string, torrentId: string | number) {
  const info = await waitForReady(apiKey, torrentId);
  const files = buildFileResults(info.files);
  if (!files.length) throw new Error('Debrid-Link returned no playable files');
  return { torrentId, files: info.files || [], results: files };
}

// ponytail: keeps a local get/set (not cachedResolve) because the cache
// stores a {torrentId, files} meta entry but returns derived `results`, so
// the cached value and the stored value differ in shape.
async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `dl:meta:${scopeKey(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey) as DlCacheEntry | null | undefined;
  if (cached) return buildFileResults(cached.files);

  const { torrentId, files, results } = await resolveTorrent(apiKey, await addTorrent(apiKey, magnetLink));
  await streamCache.set(cacheKey, { torrentId, files });
  return results;
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `dl:meta-turl:${scopeKey(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey) as DlCacheEntry | null | undefined;
  if (cached) return buildFileResults(cached.files);

  const { torrentId, files, results } = await resolveTorrent(apiKey, await addTorrentFile(apiKey, torrentUrl));
  await streamCache.set(cacheKey, { torrentId, files });
  return results;
}

async function getAccountInfo(apiKey: string) {
  const client = dlClient(apiKey);
  const res = await client.get('/account/info');
  return res.data?.value || res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
