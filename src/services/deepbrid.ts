/**
 * deepbrid.js
 * Deepbrid API client (REST v1).
 *
 * Flow:
 *   1. POST /api/v1/torrents/add  { magnet }
 *   2. Poll GET /api/v1/torrents/info?id={id} until progress === 100
 *   3. Return links[] as playable URLs
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://www.deepbrid.com/api/v1';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

function scope(apiKey: string) {
  return crypto.createHash('sha1').update(String(apiKey || '')).digest('hex').slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dpClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

function buildFileResults(links: string[], torrentName = '') {
  const mapped = (links || [])
    .map((url: string, i: number) => ({
      url: url || '',
      fileName: guessNameFromUrl(url) || (torrentName ? `${torrentName}-${i + 1}` : `file-${i + 1}`),
      fileSize: 0,
    }))
    .filter((f) => f.url);

  const video = mapped.filter((f) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

function guessNameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const opt = u.searchParams.get('opt');
    if (opt) return opt.replace(/^\./, '');
    return u.pathname.split('/').pop() || '';
  } catch (_: any) {
    return '';
  }
}

async function addTorrent(apiKey: string, magnet: string) {
  const client = dpClient(apiKey);
  const res = await client.post('/torrents/add', new URLSearchParams({ magnet }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const id = res.data?.id;
  if (!id) throw new Error(`Deepbrid add failed: ${JSON.stringify(res.data)}`);
  return String(id);
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
  form.append('torrent_file', blob, 'torrent.torrent');

  const res = await axios.post(`${BASE_URL}/torrents/add`, form, {
    timeout: 30_000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const id = res.data?.id;
  if (!id) throw new Error(`Deepbrid file add failed: ${JSON.stringify(res.data)}`);
  return String(id);
}

async function getTorrentInfo(apiKey: string, torrentId: string) {
  const client = dpClient(apiKey);
  const res = await client.get('/torrents/info', { params: { id: torrentId } });
  return res.data;
}

async function waitForReady(apiKey: string, torrentId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await getTorrentInfo(apiKey, torrentId);
    if (info?.progress === 100 && (info.links || []).length > 0) return info;
    if (info?.error === 2) throw new Error('Deepbrid torrent requires premium');
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Deepbrid torrent');
}

async function resolveTorrent(apiKey: string, torrentId: string) {
  const info = await waitForReady(apiKey, torrentId);
  const files = buildFileResults(info.links, info.filename);
  if (!files.length) throw new Error('Deepbrid returned no playable files');
  return files;
}

async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `dp:files:${scope(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const torrentId = await addTorrent(apiKey, magnetLink);
  const files = await resolveTorrent(apiKey, torrentId);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `dp:files-turl:${scope(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const torrentId = await addTorrentFile(apiKey, torrentUrl);
  const files = await resolveTorrent(apiKey, torrentId);
  await streamCache.set(cacheKey, files);
  return files;
}

async function getAccountInfo(apiKey: string) {
  const client = dpClient(apiKey);
  const res = await client.get('/user');
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
