/**
 * debrider.js
 * Debrider.app API client.
 *
 * Flow mirrors EasyDebrid:
 *   POST /api/v1/link/generate  { url: <magnet or torrent URL> }
 *   → { files: [{ filename, size, url }] }
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://debrider.app/api/v1';

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

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

function scope(apiKey: string) {
  return crypto.createHash('sha1').update(String(apiKey || '')).digest('hex').slice(0, 16);
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
  const cacheKey = `dr:files:${scope(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await generateLinks(apiKey, magnetLink);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `dr:files-turl:${scope(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await generateLinks(apiKey, torrentUrl);
  await streamCache.set(cacheKey, files);
  return files;
}

async function getAccountInfo(apiKey: string) {
  const client = drClient(apiKey);
  const res = await client.get('/user/details');
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
