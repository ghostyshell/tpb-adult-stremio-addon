/**
 * torbox.js
 * TorBox debrid API client.
 *
 * Flow for converting a magnet link to a playable URL:
 *
 *   1. Create torrent:  POST /v1/api/torrents/createtorrent  (magnet or .torrent file)
 *      - Returns { data: { torrent_id } }
 *      - If already added, returns error with existing torrent_id in data
 *   2. Poll torrent info:  GET /v1/api/torrents/mylist?id={id}&bypass_cache=true
 *      - Wait until download_state is "cached", "completed", or "uploading"
 *        AND files array is non-empty
 *   3. Request a direct CDN download URL per file:
 *      GET /v1/api/torrents/requestdl?token={key}&torrent_id={id}&file_id={fid}
 *      - Returns { data: "https://cdn..." } - a direct CDN URL returned to Stremio.
 *      - We resolve this server-side rather than handing Stremio a redirect permalink,
 *        which avoids player failures caused by how Stremio handles redirect chains.
 *
 * Caching strategy:
 *   streamCache stores { torrentId, files } metadata keyed by infoHash.
 *   CDN URLs are fetched fresh from TorBox on every stream request (not cached),
 *   so they are always valid when Stremio receives them.
 *
 * Rate limit: generous; TorBox asks not to hammer the list endpoint.
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, scopeKey } from './debridUtils';

interface TbFile { id: string | number; name?: string; short_name?: string; size?: number; }
interface TbCacheMeta { torrentId: number; files: TbFile[]; }

const BASE_URL          = 'https://api.torbox.app/v1/api';
const POLL_INTERVAL_MS  = 3000;
const POLL_TIMEOUT_MS   = 120_000;  // 2 minutes

// TorBox torrent states that mean "ready to stream"
const READY_STATES = new Set(['cached', 'completed', 'uploading']);
// States that indicate the torrent will never recover
const FATAL_STATES = new Set(['error', 'dead']);

// ── HTTP client ───────────────────────────────────────────────────────────────

function tbClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// ── Torrent creation ──────────────────────────────────────────────────────────

/**
 * Add a magnet link to TorBox.
 * If the torrent is already in the user's account, TorBox returns the existing
 * torrent_id via data even when success=false (ACTIVE_TORRENT error).
 *
 * @returns {Promise<number>}  TorBox torrent ID
 */
async function createTorrentFromMagnet(apiKey: string, magnetLink: string) {
  const client = tbClient(apiKey);
  const form = new FormData();
  form.append('magnet', magnetLink);

  const res = await client.post('/torrents/createtorrent', form);
  const body = res.data;

  // Success path
  if (body?.data?.torrent_id != null) return body.data.torrent_id;

  throw new Error(`TorBox createTorrent failed: ${body?.detail || JSON.stringify(body)}`);
}

/**
 * Add a torrent to TorBox from a .torrent file URL.
 *
 * @returns {Promise<number>}  TorBox torrent ID
 */
async function createTorrentFromFile(apiKey: string, torrentUrl: string) {
  // Download the .torrent binary
  const fileRes = await axios.get(torrentUrl, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    headers: { 'User-Agent': 'stremio-addon/1.0' },
    maxRedirects: 5,
  });

  const client = tbClient(apiKey);
  const form = new FormData();
  const blob = new Blob([fileRes.data], { type: 'application/x-bittorrent' });
  form.append('file', blob, 'torrent.torrent');

  const res = await client.post('/torrents/createtorrent', form);
  const body = res.data;

  if (body?.data?.torrent_id != null) return body.data.torrent_id;

  throw new Error(`TorBox createTorrent (file) failed: ${body?.detail || JSON.stringify(body)}`);
}

// ── Polling ───────────────────────────────────────────────────────────────────

/**
 * Fetch a single torrent entry from the user's list.
 * bypass_cache=true forces a fresh read (TorBox normally caches the list for
 * 600 seconds).
 */
async function getTorrentById(apiKey: string, torrentId: string | number) {
  const client = tbClient(apiKey);
  const res = await client.get('/torrents/mylist', {
    params: { id: String(torrentId), bypass_cache: 'true' },
  });
  // With ?id=, TorBox returns data as a single object (not an array)
  return res.data?.data || null;
}

/**
 * Poll until the torrent reaches a ready state and its file list is populated.
 *
 * @returns {Promise<object>}  Torrent info object with files array
 */
async function waitForReady(apiKey: string, torrentId: string | number) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await getTorrentById(apiKey, torrentId);
    if (!info) throw new Error(`TorBox torrent ${torrentId} not found in list`);

    const state = (info.download_state || '').toLowerCase();

    if (FATAL_STATES.has(state)) {
      throw new Error(`TorBox torrent entered fatal state: ${state}`);
    }

    if ((READY_STATES.has(state) || info.cached) && (info.files || []).length > 0) {
      return info;
    }

    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for TorBox torrent to become ready');
}

// ── URL building ──────────────────────────────────────────────────────────────

/**
 * Request a direct CDN download URL for a single file from TorBox.
 *
 * Calls GET /torrents/requestdl without redirect=true so TorBox returns the
 * CDN URL as JSON ({ data: "https://..." }) rather than issuing a redirect.
 * Returning the resolved CDN URL directly to Stremio avoids player failures
 * that can occur when Stremio's player mishandles the redirect chain.
 *
 * The token is passed as a query parameter as required by this endpoint
 * (it has no Bearer security requirement in the TorBox API spec).
 */
async function requestDownloadLink(apiKey: string, torrentId: string | number, fileId: string | number, userIp: string | undefined) {
  const res = await axios.get(`${BASE_URL}/torrents/requestdl`, {
    params: {
      token: apiKey,
      torrent_id: torrentId,
      file_id: fileId,
      // Forward the user's IP so TorBox serves the geographically nearest CDN
      // node for that user rather than for this server. Officially supported.
      ...(userIp ? { user_ip: userIp } : {}),
    },
    timeout: 15_000,
  });
  const url = res.data?.data;
  if (typeof url === 'string' && url.startsWith('http')) return url;
  throw new Error(
    `TorBox requestdl unexpected response: ${JSON.stringify(res.data)}`,
  );
}

/**
 * Convert a TorBox file list to the {url, fileName, fileSize} shape that
 * stream.js expects. Filters to video files first; falls back to all files.
 * CDN URLs are resolved fresh via requestdl on every call (not cached).
 */
async function buildFileResults(apiKey: string, torrentId: string | number, files: TbFile[], userIp: string | undefined) {
  let wanted = files.filter((f: TbFile) => VIDEO_EXT.test(f.name || f.short_name || ''));
  if (wanted.length === 0) wanted = files;

  const results = await Promise.all(
    wanted.map(async (f: TbFile) => {
      try {
        const url = await requestDownloadLink(apiKey, torrentId, f.id, userIp);
        return { url, fileName: f.short_name || f.name || '', fileSize: f.size || 0 };
      } catch (err: any) {
        console.error(`[torbox] requestdl failed for torrent ${torrentId} file ${f.id}:`, err.message);
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

// ── Cache check ───────────────────────────────────────────────────────────────

/**
 * Check whether a torrent hash is instantly available (cached) on TorBox.
 *
 * Endpoint: GET /torrents/checkcached?hash={hash}&list_files=false&format=object
 * Response: { data: { "{hash}": { cached: bool, ... } } }
 *
 * @returns {Promise<boolean>}
 */
async function checkCached(apiKey: string, infoHash: string) {
  const client = tbClient(apiKey);
  try {
    const res = await client.get('/torrents/checkcached', {
      params: { hash: infoHash, list_files: 'false', format: 'object' },
    });
    const data = res.data?.data || {};
    // Response key may be any case - compare case-insensitively.
    const key = Object.keys(data).find((k) => k.toLowerCase() === infoHash.toLowerCase());
    return !!(key && data[key]?.cached);
  } catch (_: any) {
    // If the endpoint fails, assume not cached (safe fallback).
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full pipeline: magnet → array of {url, fileName, fileSize}.
 *
 * @param {string} apiKey      TorBox API key
 * @param {string} infoHash    Torrent info-hash (hex)
 * @param {string} magnetLink  Full magnet URI
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string, userIp: string | undefined) {
  const cacheKey = `tb:meta:${scopeKey(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey) as TbCacheMeta | undefined;
  if (cached) {
    return await buildFileResults(apiKey, cached.torrentId, cached.files, userIp);
  }

  const torrentId = await createTorrentFromMagnet(apiKey, magnetLink);
  const info      = await waitForReady(apiKey, torrentId);
  const files     = info.files || [];

  if (files.length === 0) throw new Error('TorBox torrent has no files');

  await streamCache.set(cacheKey, { torrentId, files });
  return await buildFileResults(apiKey, torrentId, files, userIp);
}

/**
 * Full pipeline for .torrent file URL (no infoHash/magnet).
 *
 * @param {string} apiKey      TorBox API key
 * @param {string} torrentUrl  URL to the .torrent file
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string, userIp: string | undefined) {
  const cacheKey = `tb:meta-turl:${scopeKey(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey) as TbCacheMeta | undefined;
  if (cached) {
    return await buildFileResults(apiKey, cached.torrentId, cached.files, userIp);
  }

  const torrentId = await createTorrentFromFile(apiKey, torrentUrl);
  const info      = await waitForReady(apiKey, torrentId);
  const files     = info.files || [];

  if (files.length === 0) throw new Error('TorBox torrent (file upload) has no files');

  await streamCache.set(cacheKey, { torrentId, files });
  return await buildFileResults(apiKey, torrentId, files, userIp);
}

/**
 * Get TorBox account info (useful to verify API key).
 */
async function getAccountInfo(apiKey: string) {
  const client = tbClient(apiKey);
  const res = await client.get('/user/me');
  return res.data?.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ponytail: cache scope comes from the shared scopeKey (see debridUtils). The
// cache itself stores a {torrentId, files} meta entry and returns a derived
// buildFileResults(...) value, so it stays local rather than using cachedResolve.

export { resolveStreams, resolveStreamsFromTorrentFile, checkCached, getAccountInfo, };
