/**
 * alldebrid.js
 * AllDebrid API client.
 *
 * Flow for converting a magnet link to a playable URL:
 *
 *   1. Upload magnet:   POST /v4/magnet/upload  (magnets[]=<uri>)
 *      - Returns { data: { magnets: [{ id, hash, name, size, ready }] } }
 *      - ready=true means the torrent is already cached; skip polling.
 *   2. Poll status:     POST /v4.1/magnet/status  (id=<id>)
 *      - Wait until statusCode === 4 (Ready).
 *      - statusCode >= 5 means a terminal error.
 *   3. Get files:       POST /v4/magnet/files  (id[]=<id>)
 *      - Returns a recursive tree; flatten to get leaf file nodes
 *        { n: name, s: size, l: alldebrid-link }.
 *   4. Unlock links:    POST /v4/link/unlock  (link=<ad-link>)
 *      - Returns { data: { link: "https://cdn..." } } - the playable CDN URL.
 *
 * Rate limit: 12 req/s, 600 req/min.
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';

const BASE_URL         = 'https://api.alldebrid.com';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;  // 2 minutes

// statusCode values from AllDebrid magnet status endpoint
const STATUS_READY       = 4;
const STATUS_ERROR_FLOOR = 5;  // statusCode >= 5 are all error states

// Recognised video container extensions - matches other debrid clients
const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

// ── HTTP client ───────────────────────────────────────────────────────────────

function adClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

// ── Magnet upload ─────────────────────────────────────────────────────────────

/**
 * Upload a magnet URI to AllDebrid.
 *
 * @returns {{ id: number, ready: boolean }}
 */
async function uploadMagnet(apiKey: string, magnetLink: string) {
  const client = adClient(apiKey);
  const res = await client.post(
    '/v4/magnet/upload',
    `magnets[]=${encodeURIComponent(magnetLink)}`,
  );

  const magnet = res.data?.data?.magnets?.[0];
  if (!magnet) throw new Error('AllDebrid uploadMagnet: no magnet in response');
  if (magnet.error) throw new Error(`AllDebrid uploadMagnet: ${magnet.error.code} - ${magnet.error.message}`);

  return { id: magnet.id, ready: !!magnet.ready };
}

/**
 * Upload a .torrent file (by URL) to AllDebrid.
 *
 * @returns {{ id: number, ready: boolean }}
 */
async function uploadTorrentFile(apiKey: string, torrentUrl: string) {
  // Download the binary first
  const fileRes = await axios.get(torrentUrl, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    headers: { 'User-Agent': 'stremio-addon/1.0' },
    maxRedirects: 5,
  });

  const client = adClient(apiKey);
  const form = new FormData();
  const blob = new Blob([fileRes.data], { type: 'application/x-bittorrent' });
  form.append('files[]', blob, 'torrent.torrent');

  const res = await client.post('/v4/magnet/upload/file', form);

  const file = res.data?.data?.files?.[0];
  if (!file) throw new Error('AllDebrid uploadTorrentFile: no file in response');
  if (file.error) throw new Error(`AllDebrid uploadTorrentFile: ${file.error.code} - ${file.error.message}`);

  return { id: file.id, ready: !!file.ready };
}

// ── Polling ───────────────────────────────────────────────────────────────────

/**
 * Poll `/v4.1/magnet/status` until statusCode === 4 (Ready).
 * Throws on terminal error codes (>= 5) or timeout.
 */
async function waitForReady(apiKey: string, magnetId: string | number) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await getMagnetStatus(apiKey, magnetId);
    const code = status?.statusCode ?? -1;

    if (code === STATUS_READY) return;
    if (code >= STATUS_ERROR_FLOOR) {
      throw new Error(`AllDebrid magnet entered error state: ${status?.status || code}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for AllDebrid magnet to become ready');
}

/**
 * Fetch the status of a single magnet.
 * Returns the magnet status object (id, filename, size, status, statusCode, …).
 */
async function getMagnetStatus(apiKey: string, magnetId: string | number) {
  const client = adClient(apiKey);
  const res = await client.post('/v4.1/magnet/status', `id=${magnetId}`);
  // With a specific id, AllDebrid returns an array; take the first element.
  const magnets = res.data?.data?.magnets;
  return Array.isArray(magnets) ? magnets[0] : magnets;
}

// ── File resolution ───────────────────────────────────────────────────────────

/**
 * Fetch the file tree for a ready magnet and return flattened leaf file nodes.
 *
 * @returns {Promise<Array<{name, size, link}>>}  AllDebrid internal links (not yet CDN)
 */
async function getMagnetFiles(apiKey: string, magnetId: string | number) {
  const client = adClient(apiKey);
  const res = await client.post('/v4/magnet/files', `id[]=${magnetId}`);
  const magnet = res.data?.data?.magnets?.[0];
  if (!magnet) throw new Error(`AllDebrid getMagnetFiles: no data for id ${magnetId}`);
  if (magnet.error) throw new Error(`AllDebrid getMagnetFiles: ${magnet.error.code}`);

  return flattenFiles(magnet.files || []);
}

/**
 * Recursively flatten AllDebrid's nested file tree into a plain array of
 * leaf file nodes { name, size, link }.
 *
 * Tree node shapes:
 *   File node:   { n: string, s: number, l: string }
 *   Folder node: { n: string, e: Array<node> }
 */
function flattenFiles(nodes: any[], result: any[] = []) {
  for (const node of nodes) {
    if (node.e) {
      flattenFiles(node.e, result);  // recurse into folder
    } else if (node.l) {
      result.push({ name: node.n || '', size: node.s || 0, link: node.l });
    }
  }
  return result;
}

/**
 * Unlock a single AllDebrid internal link to a playable CDN URL.
 *
 * @returns {Promise<string>}  CDN URL
 */
async function unlockLink(apiKey: string, adLink: string) {
  const client = adClient(apiKey);
  const res = await client.post('/v4/link/unlock', `link=${encodeURIComponent(adLink)}`);
  const cdnUrl = res.data?.data?.link;
  if (!cdnUrl) throw new Error('AllDebrid unlockLink: no link in response');
  return cdnUrl;
}

// ── Full pipelines ────────────────────────────────────────────────────────────

/**
 * Core pipeline: given a ready magnet ID, collect video files and unrestrict
 * each AllDebrid link to a playable CDN URL.
 *
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveMagnetFiles(apiKey: string, magnetId: string | number) {
  const allFiles = await getMagnetFiles(apiKey, magnetId);
  if (!allFiles.length) throw new Error('AllDebrid magnet has no files');

  // Prefer video files; fall back to all files if none match.
  let wanted = allFiles.filter((f) => VIDEO_EXT.test(f.name));
  if (wanted.length === 0) wanted = allFiles;

  const out: any[] = [];
  for (const f of wanted) {
    const url = await unlockLink(apiKey, f.link).catch((err) => {
      console.error(`[alldebrid] Failed to unlock "${f.name}":`, err.message);
      return null;
    });
    if (url) out.push({ url, fileName: f.name, fileSize: f.size });
  }
  return out;
}

/**
 * Full pipeline: magnet → array of {url, fileName, fileSize}.
 *
 * @param {string} apiKey      AllDebrid API key
 * @param {string} infoHash    Torrent info-hash (hex)
 * @param {string} magnetLink  Full magnet URI
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `ad:files:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const { id, ready } = await uploadMagnet(apiKey, magnetLink);
  if (!ready) {
    await waitForReady(apiKey, id);
  }

  const files = await resolveMagnetFiles(apiKey, id);
  if (!files.length) throw new Error('No playable files returned by AllDebrid');

  await streamCache.set(cacheKey, files);
  return files;
}

/**
 * Full pipeline for a .torrent file URL (no infoHash/magnet available).
 *
 * @param {string} apiKey      AllDebrid API key
 * @param {string} torrentUrl  URL to the .torrent file
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `ad:files-turl:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const { id, ready } = await uploadTorrentFile(apiKey, torrentUrl);
  if (!ready) {
    await waitForReady(apiKey, id);
  }

  const files = await resolveMagnetFiles(apiKey, id);
  if (!files.length) throw new Error('No playable files returned by AllDebrid (torrent file)');

  await streamCache.set(cacheKey, files);
  return files;
}

/**
 * Get AllDebrid account info (useful to verify API key).
 */
async function getAccountInfo(apiKey: string) {
  const client = adClient(apiKey);
  const res = await client.get('/v4/user');
  return res.data?.data?.user;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
