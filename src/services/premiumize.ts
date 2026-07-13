/**
 * premiumize.js
 * Premiumize API client.
 *
 * Flow for converting a magnet link to a playable URL:
 *
 *   1. Direct DL attempt:  POST /transfer/directdl  (src=<magnet>)
 *      - If the content is already cached, returns a `content` array
 *        immediately with `stream_link` / `link` values.
 *   2. If not cached, create a transfer:  POST /transfer/create  (src=<magnet>)
 *      - Returns { id, name }
 *   3. Poll /transfer/list until the transfer with our ID reaches
 *      status === "finished" (or "seeding" with progress === 1).
 *   4. Retry the direct DL call - the content is now cached.
 *
 * Caching strategy:
 *   stream_link / link CDN URLs returned by Premiumize do NOT embed the API
 *   key in the URL, so they can be cached permanently under `pm:files:*`
 *   keys the same way Real-Debrid URLs are cached.
 *
 * Auth:
 *   All requests pass `apikey` as a query-string parameter (GET) or a body
 *   field (POST). Bearer auth is not supported by Premiumize.
 *
 * Rate limit: undocumented; be conservative.
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, cachedResolve, scopeKey } from './debridUtils';

const BASE_URL         = 'https://www.premiumize.me/api';
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS  = 180_000;  // 3 minutes (Premiumize can be slower)

// ── HTTP client ───────────────────────────────────────────────────────────────

function pmClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // apiKey is passed per-request (query param for GET, body for POST)
    params: { apikey: apiKey },
  });
}

// ── Direct DL ─────────────────────────────────────────────────────────────────

/**
 * Attempt to get direct download links for a magnet / torrent URL.
 * Premiumize returns content immediately if the torrent is in their cache.
 *
 * @returns {Array<{name, size, link}>|null}
 *   Array of file objects if cached; null if not cached / error.
 */
async function directDL(apiKey: string, src: string) {
  const client = pmClient(apiKey);
  try {
    const res = await client.post('/transfer/directdl', `src=${encodeURIComponent(src)}`);
    if (res.data?.status === 'success' && Array.isArray(res.data.content) && res.data.content.length > 0) {
      return res.data.content;
    }
  } catch (_: any) {
    // Network / auth errors - fall through to transfer flow
  }
  return null;
}

// ── Transfer create + poll ────────────────────────────────────────────────────

/**
 * Create a Premiumize cloud transfer (torrent download) from a magnet or URL.
 *
 * @returns {Promise<string>}  Transfer ID
 */
async function createTransfer(apiKey: string, src: string) {
  const client = pmClient(apiKey);
  const res = await client.post('/transfer/create', `src=${encodeURIComponent(src)}`);
  if (res.data?.status !== 'success') {
    throw new Error(`Premiumize createTransfer failed: ${res.data?.message || JSON.stringify(res.data)}`);
  }
  return res.data.id;
}

/**
 * Fetch the full transfer list and find the entry for a given transfer ID.
 * Returns null if the transfer is not yet in the list.
 */
async function getTransferById(apiKey: string, transferId: string) {
  const client = pmClient(apiKey);
  const res = await client.get('/transfer/list');
  const transfers = res.data?.transfers;
  if (!Array.isArray(transfers)) return null;
  return transfers.find((t) => t.id === transferId) || null;
}

/**
 * Poll the transfer list until our transfer reaches status "finished"
 * (or the rare "seeding" state with full progress).
 * Throws on "error" status or timeout.
 */
async function waitForTransfer(apiKey: string, transferId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const transfer = await getTransferById(apiKey, transferId);
    if (!transfer) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const status = (transfer.status || '').toLowerCase();

    if (status === 'error') {
      throw new Error(`Premiumize transfer entered error state: ${transfer.message || transferId}`);
    }

    // "finished" = fully downloaded; "seeding" with progress 1.0 also means done
    if (status === 'finished' || (status === 'seeding' && transfer.progress >= 1)) {
      return transfer;
    }

    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Premiumize transfer to finish');
}

// ── File list helpers ─────────────────────────────────────────────────────────

/**
 * List files in a Premiumize folder.
 *
 * @param {string} folderId  Premiumize folder ID
 * @returns {Promise<Array<{name, size, link, stream_link}>>}  Flat file array
 */
async function listFolder(apiKey: string, folderId: string) {
  const client = pmClient(apiKey);
  const res = await client.get('/folder/list', { params: { apikey: apiKey, id: folderId } });
  if (res.data?.status !== 'success') {
    throw new Error(`Premiumize folder/list failed: ${res.data?.message || folderId}`);
  }
  const items = res.data.content || [];
  return flattenFolderItems(apiKey, items);
}

/**
 * Recursively flatten folder items to leaf file nodes.
 * Premiumize can nest files inside sub-folders (type === "folder").
 */
async function flattenFolderItems(apiKey: string, items: any[]) {
  const files: any[] = [];
  for (const item of items) {
    if (item.type === 'folder' && item.id) {
      const sub = await listFolder(apiKey, item.id).catch(() => []);
      files.push(...sub);
    } else if (item.type === 'file') {
      files.push({
        name:        item.name || '',
        size:        item.size || 0,
        link:        item.stream_link || item.link || '',
      });
    }
  }
  return files;
}

/**
 * Normalise Premiumize directdl `content` items to the common
 * {name, size, link} shape.
 */
function normaliseContent(items: any[]) {
  return items.map((item: any) => ({
    name: item.path ? item.path.split('/').filter(Boolean).pop() : (item.name || ''),
    size: Number(item.size) || 0,
    link: item.stream_link || item.link || '',
  }));
}

// ── Core file-resolution pipeline ─────────────────────────────────────────────

/**
 * Given a flat list of Premiumize file items, filter to video files and
 * return the common {url, fileName, fileSize} shape.
 */
function buildFileResults(rawFiles: any[]) {
  const normalised = rawFiles
    .map((f: any) => ({
      url:      f.link || f.stream_link || '',
      fileName: f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f: any) => f.url);

  // Prefer video files; fall back to all files if none match
  const video = normalised.filter((f: any) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : normalised;
}

/**
 * Full resolution pipeline for a single src (magnet or torrent URL):
 *   1. Try directdl (instant if cached).
 *   2. Fallback: create transfer, poll until done, retry directdl.
 *   3. If directdl still fails, enumerate via folder/list API.
 *
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveSrc(apiKey: string, src: string) {
  // 1. Try directdl first
  const content = await directDL(apiKey, src);
  if (content) {
    return buildFileResults(normaliseContent(content));
  }

  // 2. Not cached - create a transfer and wait
  const transferId = await createTransfer(apiKey, src);
  const transfer   = await waitForTransfer(apiKey, transferId);

  // 3a. Retry directdl - should succeed now that the transfer is finished
  const content2 = await directDL(apiKey, src);
  if (content2) {
    return buildFileResults(normaliseContent(content2));
  }

  // 3b. directdl still failed - fall back to folder/list using folder_id from transfer
  if (transfer.folder_id) {
    const folderFiles = await listFolder(apiKey, transfer.folder_id);
    return buildFileResults(folderFiles);
  }

  throw new Error('Premiumize: could not retrieve file list after transfer completion');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full pipeline: magnet → array of {url, fileName, fileSize}.
 *
 * @param {string} apiKey      Premiumize API key
 * @param {string} infoHash    Torrent info-hash (hex)
 * @param {string} magnetLink  Full magnet URI
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  // Scope by apiKey. PM CDN links can be account/IP-bound.
  const cacheKey = `pm:files:${scopeKey(apiKey)}:${infoHash}`;
  return cachedResolve(streamCache, cacheKey, async () => {
    const files = await resolveSrc(apiKey, magnetLink);
    if (!files.length) {
      throw new Error('No playable files returned by Premiumize');
    }
    return files;
  });
}

/**
 * Full pipeline for a .torrent file URL (no infoHash/magnet available).
 *
 * @param {string} apiKey      Premiumize API key
 * @param {string} torrentUrl  URL to the .torrent file
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `pm:files-turl:${scopeKey(apiKey)}:${torrentUrl}`;
  return cachedResolve(streamCache, cacheKey, async () => {
    const files = await resolveSrc(apiKey, torrentUrl);
    if (!files.length) {
      throw new Error('No playable files returned by Premiumize (torrent file)');
    }
    return files;
  });
}

/**
 * Get Premiumize account info (useful to verify API key).
 */
async function getAccountInfo(apiKey: string) {
  const client = pmClient(apiKey);
  const res = await client.get('/account/info');
  return res.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
