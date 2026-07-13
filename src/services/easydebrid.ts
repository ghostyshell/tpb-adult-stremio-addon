/**
 * easydebrid.js
 * EasyDebrid API client.
 *
 * Flow:
 *   POST /api/v1/link/generate  { url: <magnet or torrent URL> }
 *   → { files: [{ filename, size, url }] }
 *
 * Cached lookups are available via POST /api/v1/link/lookup but generate
 * handles both cached and uncached sources in one call.
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, scopeKey, cachedResolve } from './debridUtils';

const BASE_URL = 'https://easydebrid.com/api/v1';

interface EdFile { url?: string; filename?: string; name?: string; size?: number }

function edClient(apiKey: string) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

function buildFileResults(files: EdFile[]) {
  const mapped = (files || [])
    .map((f) => ({
      url: f.url || '',
      fileName: f.filename || f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f) => f.url);

  const video = mapped.filter((f) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function generateLinks(apiKey: string, src: string) {
  const client = edClient(apiKey);
  const res = await client.post('/link/generate', { url: src });
  const files = buildFileResults(res.data?.files);
  if (!files.length) throw new Error('EasyDebrid returned no playable files');
  return files;
}

async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `ed:files:${scopeKey(apiKey)}:${infoHash}`;
  return cachedResolve(streamCache, cacheKey, () => generateLinks(apiKey, magnetLink));
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `ed:files-turl:${scopeKey(apiKey)}:${torrentUrl}`;
  return cachedResolve(streamCache, cacheKey, () => generateLinks(apiKey, torrentUrl));
}

async function getAccountInfo(apiKey: string) {
  const client = edClient(apiKey);
  const res = await client.get('/user/details');
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
