/**
 * linksnappy.js
 * LinkSnappy API client.
 *
 * Credentials: username:password (stored in lsKey).
 *
 * Flow (from ResolveURL plugin):
 *   1. GET /api/AUTHENTICATE?username=…&password=…  → session cookies
 *   2. GET /api/torrents/ADDMAGNET?magnetlinks=…
 *   3. GET /api/torrents/START?tid=…&fid=…
 *   4. Poll GET /api/torrents/STATUS?tid=… until status === FINISHED
 *   5. GET /api/torrents/FILES?id=… → video downloadLink URLs
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://linksnappy.com/api';
const USER_AGENT = 'stremio-addon/1.0';
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 180_000;

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

interface LsVideo { downloadLink?: string; text?: string; name?: string; size?: number; isVideo?: string }

function scope(creds: string) {
  return crypto.createHash('sha1').update(String(creds || '')).digest('hex').slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCreds(creds: string) {
  const i = String(creds || '').indexOf(':');
  if (i < 1) throw new Error('LinkSnappy requires username:password in lsKey');
  return { username: creds.slice(0, i), password: creds.slice(i + 1) };
}

function cookieHeader(setCookie: string | string[] | undefined) {
  if (!setCookie) return '';
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((c) => c.split(';')[0]).join('; ');
}

async function authenticate(creds: string) {
  const { username, password } = parseCreds(creds);
  const res = await axios.get(`${BASE_URL}/AUTHENTICATE`, {
    params: { username, password },
    timeout: 20_000,
    headers: { 'User-Agent': USER_AGENT },
    validateStatus: () => true,
  });
  const body = res.data;
  if (body?.status !== 'OK') {
    throw new Error(`LinkSnappy auth failed: ${body?.error || JSON.stringify(body)}`);
  }
  const cookie = cookieHeader(res.headers['set-cookie']);
  if (!cookie) throw new Error('LinkSnappy auth: no session cookie');
  return cookie;
}

async function lsGet(path: string, cookie: string) {
  const res = await axios.get(`${BASE_URL}/${path}`, {
    timeout: 30_000,
    headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    maxRedirects: 5,
  });
  return res.data;
}

async function getFolderId(cookie: string) {
  const result = await lsGet('torrents/FOLDERLIST', cookie);
  if (result?.status !== 'OK') return '0';
  const items = result.return || [];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === 'root') return String(item.id || '0');
  }
  return '0';
}

async function addMagnet(cookie: string, magnet: string) {
  const result = await lsGet(`torrents/ADDMAGNET?magnetlinks=${encodeURIComponent(magnet)}`, cookie);
  if (result?.status !== 'OK' || result?.error) {
    throw new Error(`LinkSnappy add magnet failed: ${result?.error || JSON.stringify(result)}`);
  }
  const torrent = (result.return || [])[0] || {};
  const torrentId = torrent.torrentid;
  if (!torrentId) throw new Error('LinkSnappy add magnet: no torrent id');
  return String(torrentId);
}

async function addTorrentUrl(cookie: string, torrentUrl: string) {
  const result = await lsGet(`torrents/ADDURL?url=${encodeURIComponent(torrentUrl)}`, cookie);
  if (!result || typeof result !== 'object') {
    throw new Error('LinkSnappy add torrent URL failed');
  }
  const entry: any = Object.values(result as any).find((v: any) => v && typeof v === 'object' && v.torrentid);
  const torrentId = entry?.torrentid;
  if (!torrentId) throw new Error('LinkSnappy add torrent URL: no torrent id');
  return String(torrentId);
}

async function startTransfer(cookie: string, torrentId: string, folderId: string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await lsGet(`torrents/START?tid=${torrentId}&fid=${folderId}`, cookie);
    if (result?.error === false) return;
    if (result?.error && result.error !== 'Magnet URI processing in progress. Please wait.') {
      throw new Error(`LinkSnappy start failed: ${result.error}`);
    }
    await sleep(3000);
  }
  throw new Error('Timed out starting LinkSnappy transfer');
}

async function waitForFinished(cookie: string, torrentId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await lsGet(`torrents/STATUS?tid=${torrentId}`, cookie);
    const info = result?.return || {};
    if (info.status === 'FINISHED') return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for LinkSnappy torrent');
}

function collectVideos(tree: any) {
  const videos: any[] = [];
  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') {
        const vid: any = v;
        if (vid.isVideo === 'y' && vid.downloadLink) videos.push(vid);
        else walk(v);
      }
    }
  }
  walk(tree);
  return videos;
}

function buildFileResults(videos: LsVideo[]) {
  const mapped = videos
    .map((v) => ({
      url: v.downloadLink || '',
      fileName: v.text || v.name || '',
      fileSize: Number(v.size) || 0,
    }))
    .filter((f) => f.url);

  const filtered = mapped.filter((f) => VIDEO_EXT.test(f.fileName));
  const pick = (filtered.length ? filtered : mapped).sort((a, b) => b.fileSize - a.fileSize);
  return pick;
}

async function resolveTorrent(cookie: string, torrentId: string) {
  const folderId = await getFolderId(cookie);
  await startTransfer(cookie, torrentId, folderId);
  await waitForFinished(cookie, torrentId);
  await sleep(1500);

  const result = await lsGet(`torrents/FILES?id=${torrentId}`, cookie);
  if (result?.status !== 'OK') throw new Error('LinkSnappy files lookup failed');

  const videos = collectVideos(result);
  const files = buildFileResults(videos);
  if (!files.length) throw new Error('LinkSnappy returned no playable files');
  return files;
}

async function resolveSrc(creds: string, src: string, isMagnet: boolean) {
  const cookie = await authenticate(creds);
  const torrentId = isMagnet ? await addMagnet(cookie, src) : await addTorrentUrl(cookie, src);
  return resolveTorrent(cookie, torrentId);
}

async function resolveStreams(creds: string, infoHash: string, magnetLink: string) {
  const cacheKey = `ls:files:${scope(creds)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await resolveSrc(creds, magnetLink, true);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(creds: string, torrentUrl: string) {
  const cacheKey = `ls:files-turl:${scope(creds)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await resolveSrc(creds, torrentUrl, false);
  await streamCache.set(cacheKey, files);
  return files;
}

export { resolveStreams, resolveStreamsFromTorrentFile, };
