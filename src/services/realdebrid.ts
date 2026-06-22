/**
 * realdebrid.js
 * Real-Debrid API client.
 *
 * Flow for converting a magnet link to a playable URL:
 *
 *   1. Check instant availability:  GET /torrents/instantAvailability/{hash}
 *      - If cached → step 2 immediately
 *   2. Add magnet:                  POST /torrents/addMagnet
 *      - Returns { id, uri }
 *   3. Select files:                POST /torrents/selectFiles/{id}
 *      - body: files=all
 *   4. Poll torrent info:           GET /torrents/info/{id}
 *      - Wait until status === "downloaded" or "magnet_conversion"
 *   5. Unrestrict link:             POST /unrestrict/link
 *      - body: link=<download_link>
 *      - Returns { download: "https://..." }  ← the playable CDN URL
 *
 * Rate limit: 250 requests/minute.
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://api.real-debrid.com/rest/1.0';
const POLL_INTERVAL_MS    = 2000;
const POLL_TIMEOUT_MS     = 120_000;  // full background prewarm
const QUICK_POLL_TIMEOUT_MS = 18_000; // interactive stream request budget
const FILELIST_TIMEOUT_MS = 30_000;

// Recognised video container extensions - used to select only playable files
// from a torrent (skipping samples, images, .nfo, etc.).
const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

/**
 * Create an axios instance with RD auth header.
 */
function rdClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

/**
 * Append the end user's IP to a form-encoded body when provided. Real-Debrid
 * reads an `ip` field on its POST endpoints and attributes the request to that
 * IP instead of the caller's, which keeps the activity tied to the user rather
 * than this server (avoids datacenter/account-sharing flags). No-op when absent.
 */
function withIp(body: string, userIp?: string) {
  return userIp ? `${body}&ip=${encodeURIComponent(userIp)}` : body;
}

/**
 * Cache scope token unique to a (user account, user IP) pair. A minted RD CDN
 * URL is bound to the IP forwarded at unrestrict time, so cached URLs must never
 * be served to a different user or IP. The API key is hashed so the raw secret
 * never appears in a cache key.
 */
function scope(apiKey: string, userIp?: string) {
  return crypto
    .createHash('sha1')
    .update(`${apiKey || ''}|${userIp || ''}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Check if a torrent hash is instantly available (cached) on Real-Debrid.
 *
 * @returns {object|null}  - file variant map if available, null otherwise
 */
async function checkInstantAvailability(apiKey: string, infoHash: string) {
  const client = rdClient(apiKey);
  try {
    const res = await client.get(`/torrents/instantAvailability/${infoHash.toLowerCase()}`);
    const data = res.data;
    // Response structure: { "{hash}": { "rd": [ { "1": {filename, filesize}, ... } ] } }
    const key  = Object.keys(data)[0];
    if (!key) return null;
    const rdArr = data[key]?.rd;
    if (!rdArr || rdArr.length === 0) return null;
    // Return the first available file set
    return rdArr[0];
  } catch (_: any) {
    return null;
  }
}

/**
 * Add a magnet link to Real-Debrid.
 * Returns the torrent ID.
 */
async function addMagnet(apiKey: string, magnetLink: string, userIp?: string) {
  const client = rdClient(apiKey);
  const res = await client.post('/torrents/addMagnet', withIp(`magnet=${encodeURIComponent(magnetLink)}`, userIp));
  return res.data.id;
}

/**
 * Find an existing RD torrent id for this infoHash in the user's library.
 */
async function findExistingTorrentId(apiKey: string, infoHash: string) {
  const hash = (infoHash || '').toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(hash)) return null;
  const client = rdClient(apiKey);
  try {
    const res = await client.get('/torrents', { params: { limit: 200 } });
    const torrents = Array.isArray(res.data) ? res.data : [];
    const found = torrents.find((t) => (t.hash || '').toLowerCase() === hash);
    return found?.id ?? null;
  } catch (_: any) {
    return null;
  }
}

/** Reuse an existing RD torrent row when possible to avoid duplicate adds. */
async function createOrFindTorrentId(apiKey: string, infoHash: string, magnetLink: string, userIp?: string) {
  const existing = await findExistingTorrentId(apiKey, infoHash);
  if (existing) return existing;
  return addMagnet(apiKey, magnetLink, userIp);
}

/**
 * Select files in a torrent for downloading.
 * @param {string} fileIds - "all" or comma-separated RD file IDs
 */
async function selectFiles(apiKey: string, torrentId: string, fileIds = 'all', userIp?: string) {
  const client = rdClient(apiKey);
  await client.post(`/torrents/selectFiles/${torrentId}`, withIp(`files=${fileIds}`, userIp));
}

/** Back-compat wrapper: select every file. */
async function selectAllFiles(apiKey: string, torrentId: string, userIp?: string) {
  return selectFiles(apiKey, torrentId, 'all', userIp);
}

/**
 * After addMagnet/addTorrent, RD needs a moment to convert the magnet and
 * list its files (status "waiting_files_selection"). Poll until files appear.
 */
async function waitForFileList(apiKey: string, torrentId: string) {
  const deadline = Date.now() + FILELIST_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await getTorrentInfo(apiKey, torrentId);
    if (info.files && info.files.length > 0) return info;
    if (['error', 'magnet_error', 'virus', 'dead'].includes(info.status)) {
      throw new Error(`Real-Debrid torrent status: ${info.status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Real-Debrid file list');
}

/**
 * Core multi-file pipeline: given a torrent already added to RD, select only
 * its video files, wait for download links, and unrestrict each into a
 * playable CDN URL. Selecting only video files (instead of "all") is what
 * lets multi-file packs resolve - otherwise RD blocks on uncached sample
 * images/.nfo files and never reports "downloaded".
 *
 * @returns {Promise<Array<{url, fileName, fileSize}>>}
 */
async function resolveTorrentFiles(apiKey: string, torrentId: string, userIp?: string, pollTimeoutMs = POLL_TIMEOUT_MS) {
  const listed = await waitForFileList(apiKey, torrentId);
  const allFiles = listed.files || [];

  // Prefer video files; fall back to everything if none look like video.
  let wanted = allFiles.filter((f: any) => VIDEO_EXT.test(f.path || ''));
  if (wanted.length === 0) wanted = allFiles;

  const ids = wanted.map((f: any) => f.id).join(',') || 'all';
  await selectFiles(apiKey, torrentId, ids, userIp);

  const links = await waitForLinks(apiKey, torrentId, pollTimeoutMs);

  // Re-read info so we can map links → file names. RD returns `links` in the
  // order of the selected files (ascending file id).
  const info = await getTorrentInfo(apiKey, torrentId);
  const selected = (info.files || [])
    .filter((f: any) => f.selected === 1)
    .sort((a: any, b: any) => a.id - b.id);

  const out: any[] = [];
  for (let i = 0; i < links.length; i++) {
    const url = await unrestrictLink(apiKey, links[i], userIp).catch(() => null);
    if (!url) continue;
    const f = selected[i];
    out.push({
      url,
      fileName: f ? basename(f.path) : '',
      fileSize: f ? (f.bytes || 0) : 0,
    });
  }
  return out;
}

/**
 * Get torrent info from Real-Debrid.
 */
async function getTorrentInfo(apiKey: string, torrentId: string) {
  const client = rdClient(apiKey);
  const res = await client.get(`/torrents/info/${torrentId}`);
  return res.data;
}

/**
 * Poll until the torrent has download links ready.
 * Returns the array of RD download links.
 */
async function waitForLinks(apiKey: string, torrentId: string, timeoutMs = POLL_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await getTorrentInfo(apiKey, torrentId);
    if (['downloaded', 'magnet_conversion'].includes(info.status) && info.links?.length) {
      return info.links;
    }
    if (['error', 'magnet_error', 'virus', 'dead'].includes(info.status)) {
      throw new Error(`Real-Debrid torrent status: ${info.status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Real-Debrid download links');
}

/**
 * Unrestrict a Real-Debrid download link to get a playable CDN URL.
 */
async function unrestrictLink(apiKey: string, rdLink: string, userIp?: string) {
  const client = rdClient(apiKey);
  const res = await client.post('/unrestrict/link', withIp(`link=${encodeURIComponent(rdLink)}`, userIp));
  return res.data.download; // direct CDN URL
}

/**
 * Unrestrict every selected link on an already-downloaded RD torrent.
 */
async function unrestrictDownloadedLinks(apiKey: string, info: any, userIp?: string) {
  const links = info.links || [];
  if (!links.length) return [];

  const selected = (info.files || [])
    .filter((f: any) => f.selected === 1)
    .sort((a: any, b: any) => a.id - b.id);

  const out: any[] = [];
  for (let i = 0; i < links.length; i++) {
    const url = await unrestrictLink(apiKey, links[i], userIp).catch(() => null);
    if (!url) continue;
    const f = selected[i];
    out.push({
      url,
      fileName: f ? basename(f.path) : '',
      fileSize: f ? (f.bytes || 0) : 0,
    });
  }
  return out;
}

/**
 * If the torrent is already in the user's RD library and downloaded, unrestrict
 * immediately instead of re-adding and polling.
 */
async function resolveExistingLibraryTorrent(apiKey: string, infoHash: string, userIp?: string) {
  const torrentId = await findExistingTorrentId(apiKey, infoHash);
  if (!torrentId) return null;

  const info = await getTorrentInfo(apiKey, torrentId);
  if (!['downloaded', 'magnet_conversion'].includes(info.status) || !info.links?.length) {
    return null;
  }

  const files = await unrestrictDownloadedLinks(apiKey, info, userIp);
  return files.length ? files : null;
}

/**
 * Full pipeline: magnet → playable URL.
 *
 * Checks the stream cache first.  If not cached:
 *   1. Add magnet
 *   2. Select files
 *   3. Poll for links
 *   4. Unrestrict the best link (largest video file)
 *   5. Cache and return
 *
 * @param {string} apiKey      - Real-Debrid API key
 * @param {string} infoHash    - torrent info-hash (hex)
 * @param {string} magnetLink  - full magnet URI
 * @returns {Promise<Array<{url,fileName,fileSize}>>}
 */
async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string, userIp?: string): Promise<any[]> {
  const cacheKey = `files:${scope(apiKey, userIp)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey) as any;
  if (cached) return cached;

  const existing = await resolveExistingLibraryTorrent(apiKey, infoHash, userIp);
  if (existing?.length) {
    await streamCache.set(cacheKey, existing);
    return existing;
  }

  const torrentId = await createOrFindTorrentId(apiKey, infoHash, magnetLink, userIp);
  const files = await resolveTorrentFiles(apiKey, torrentId, userIp, POLL_TIMEOUT_MS);
  if (!files.length) {
    throw new Error('No playable files returned by Real-Debrid');
  }

  await streamCache.set(cacheKey, files);
  return files;
}

/**
 * Interactive stream resolve: return quickly when RD already has the torrent
 * cached. When RD still has to download, return null so the caller can show a
 * P2P fallback immediately and optionally prewarm in the background.
 */
async function resolveStreamsQuick(apiKey: string, infoHash: string, magnetLink: string, userIp?: string) {
  const cacheKey = `files:${scope(apiKey, userIp)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey) as any;
  if (cached) return cached;

  const existing = await resolveExistingLibraryTorrent(apiKey, infoHash, userIp);
  if (existing?.length) {
    await streamCache.set(cacheKey, existing);
    return existing;
  }

  const torrentId = await createOrFindTorrentId(apiKey, infoHash, magnetLink, userIp);
  try {
    const files = await resolveTorrentFiles(apiKey, torrentId, userIp, QUICK_POLL_TIMEOUT_MS);
    if (!files.length) return null;
    await streamCache.set(cacheKey, files);
    return files;
  } catch (err: any) {
    if (String(err.message || '').includes('Timed out waiting for Real-Debrid')) {
      return null;
    }
    throw err;
  }
}

/**
 * Back-compat single-URL resolver: returns just the first playable file's URL.
 */
async function resolveStream(apiKey: string, infoHash: string, magnetLink: string, userIp?: string) {
  const files = await resolveStreams(apiKey, infoHash, magnetLink, userIp);
  return files[0]?.url;
}

/**
 * Add a torrent to Real-Debrid from a .torrent file URL.
 * Used when the indexer returns a .torrent download link instead of a magnet.
 *
 * @param {string} apiKey      - Real-Debrid API key
 * @param {string} torrentUrl  - URL to the .torrent file
 * @returns {Promise<string>}  - RD torrent ID
 */
async function addTorrentFile(apiKey: string, torrentUrl: string, userIp?: string) {
  // Download the .torrent file as binary
  const fileRes = await axios.get(torrentUrl, {
    responseType: 'arraybuffer',
    timeout: 20000,
    headers: { 'User-Agent': 'stremio-tpb-porn/1.0' },
    maxRedirects: 5,
  });

  // POST binary to RD - override Content-Type (instance default is form-encoded).
  // The body is the raw torrent, so the user IP rides along as a query param.
  const client = rdClient(apiKey);
  const res = await client.post('/torrents/addTorrent', fileRes.data, {
    headers: { 'Content-Type': 'application/x-bittorrent' },
    params: userIp ? { ip: userIp } : undefined,
  });
  return res.data.id;
}

/**
 * Full pipeline for when we only have a .torrent file URL (no infoHash/magnet).
 * Uploads the torrent file to RD, selects all files, polls for links, unrestricts.
 *
 * @param {string} apiKey      - Real-Debrid API key
 * @param {string} torrentUrl  - URL to the .torrent file
 * @returns {Promise<string>}  - playable CDN URL
 */
async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string, userIp?: string): Promise<any[]> {
  const cacheKey = `files-turl:${scope(apiKey, userIp)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey) as any;
  if (cached) return cached;

  const torrentId = await addTorrentFile(apiKey, torrentUrl, userIp);
  const files = await resolveTorrentFiles(apiKey, torrentId, userIp, POLL_TIMEOUT_MS);
  if (!files.length) {
    throw new Error('No playable files returned by Real-Debrid');
  }

  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFileQuick(apiKey: string, torrentUrl: string, userIp?: string) {
  const cacheKey = `files-turl:${scope(apiKey, userIp)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey) as any;
  if (cached) return cached;

  const torrentId = await addTorrentFile(apiKey, torrentUrl, userIp);
  try {
    const files = await resolveTorrentFiles(apiKey, torrentId, userIp, QUICK_POLL_TIMEOUT_MS);
    if (!files.length) return null;
    await streamCache.set(cacheKey, files);
    return files;
  } catch (err: any) {
    if (String(err.message || '').includes('Timed out waiting for Real-Debrid')) {
      return null;
    }
    throw err;
  }
}

/** Continue a full RD resolve in the background to warm streamCache. */
function prewarmStreams(apiKey: string, infoHash: string, magnetLink: string, userIp?: string, torrentUrl?: string) {
  const job = torrentUrl
    ? resolveStreamsFromTorrentFile(apiKey, torrentUrl, userIp)
    : resolveStreams(apiKey, infoHash, magnetLink, userIp);
  return job.catch((err) => {
    console.error(`[realdebrid] prewarm failed for ${infoHash || torrentUrl}:`, err.message);
  });
}

/** Back-compat single-URL resolver from a .torrent file URL. */
async function resolveStreamFromTorrentFile(apiKey: string, torrentUrl: string, userIp?: string) {
  const files = await resolveStreamsFromTorrentFile(apiKey, torrentUrl, userIp);
  return files[0]?.url;
}

/**
 * Get Real-Debrid account info (useful to verify API key).
 */
async function getAccountInfo(apiKey: string) {
  const client = rdClient(apiKey);
  const res = await client.get('/user');
  return res.data;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Last path segment of an RD file path ("/Folder/clip.mp4" → "clip.mp4"). */
function basename(p: unknown) {
  return String(p || '').split('/').filter(Boolean).pop() || '';
}

/** Human-readable byte size, e.g. 1500000000 → "1.40 GB". */
function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
}

export { resolveStream, resolveStreams, resolveStreamsQuick, resolveStreamFromTorrentFile, resolveStreamsFromTorrentFile, resolveStreamsFromTorrentFileQuick, prewarmStreams, checkInstantAvailability, addMagnet, addTorrentFile, selectFiles, selectAllFiles, getTorrentInfo, waitForLinks, unrestrictLink, getAccountInfo, formatBytes, };
