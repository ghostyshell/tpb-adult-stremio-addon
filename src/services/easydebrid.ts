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
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://easydebrid.com/api/v1';

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

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

function scope(apiKey: string) {
  return crypto.createHash('sha1').update(String(apiKey || '')).digest('hex').slice(0, 16);
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
  const cacheKey = `ed:files:${scope(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await generateLinks(apiKey, magnetLink);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `ed:files-turl:${scope(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await generateLinks(apiKey, torrentUrl);
  await streamCache.set(cacheKey, files);
  return files;
}

async function getAccountInfo(apiKey: string) {
  const client = edClient(apiKey);
  const res = await client.get('/user/details');
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
