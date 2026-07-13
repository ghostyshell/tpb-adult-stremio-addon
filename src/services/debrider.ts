/**
 * debrider.js
 * Debrider.app API client.
 *
 * Flow mirrors EasyDebrid:
 *   POST /api/v1/link/generate  { url: <magnet or torrent URL> }
 *   → { files: [{ filename, size, url }] }
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, scopeKey, cachedResolve } from './debridUtils';

const BASE_URL = 'https://debrider.app/api/v1';

interface DrFile { url?: string; download_link?: string; filename?: string; name?: string; size?: number }

function drClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

function buildFileResults(files: DrFile[]) {
  const mapped = (files || [])
    .map((f) => ({
      url: f.url || f.download_link || '',
      fileName: f.filename || f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f) => f.url);

  const video = mapped.filter((f) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function generateLinks(apiKey: string, src: string) {
  const client = drClient(apiKey);
  const res = await client.post('/link/generate', { url: src });
  const files = buildFileResults(res.data?.files);
  if (!files.length) throw new Error('Debrider returned no playable files');
  return files;
}

async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `dr:files:${scopeKey(apiKey)}:${infoHash}`;
  return cachedResolve(streamCache, cacheKey, () => generateLinks(apiKey, magnetLink));
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `dr:files-turl:${scopeKey(apiKey)}:${torrentUrl}`;
  return cachedResolve(streamCache, cacheKey, () => generateLinks(apiKey, torrentUrl));
}

async function getAccountInfo(apiKey: string) {
  const client = drClient(apiKey);
  const res = await client.get('/user/details');
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
