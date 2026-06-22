/**
 * offcloud.js
 * Offcloud API client.
 *
 * Flow:
 *   1. POST /api/cloud  { url: <magnet> }  ?key=<apiKey>
 *   2. Poll GET /api/cloud/status  ?key=<apiKey>&requestId=<id>
 *      until status === "downloaded"
 *   3. Return file URLs from the status payload
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://offcloud.com/api';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

interface OcFile { url?: string; fileName?: string; name?: string; size?: number }

function scope(apiKey: string) {
  return crypto.createHash('sha1').update(String(apiKey || '')).digest('hex').slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addCloudItem(apiKey: string, url: string) {
  const res = await axios.post(`${BASE_URL}/cloud`, { url }, {
    params: { key: apiKey },
    timeout: 20_000,
  });
  const requestId = res.data?.requestId;
  if (!requestId) throw new Error('Offcloud cloud add: no requestId');
  return requestId;
}

async function getCloudStatus(apiKey: string, requestId: string) {
  const res = await axios.get(`${BASE_URL}/cloud/status`, {
    params: { key: apiKey, requestId },
    timeout: 15_000,
  });
  return res.data;
}

async function waitForReady(apiKey: string, requestId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await getCloudStatus(apiKey, requestId);
    if (status?.status === 'downloaded') return status;
    if (status?.status === 'error') {
      throw new Error('Offcloud download entered error state');
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Offcloud download');
}

function buildFileResults(files: OcFile[]) {
  const mapped = (files || [])
    .map((f) => ({
      url: f.url || '',
      fileName: f.fileName || f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f) => f.url);

  const video = mapped.filter((f) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function resolveSrc(apiKey: string, src: string) {
  const requestId = await addCloudItem(apiKey, src);
  const status = await waitForReady(apiKey, requestId);
  const files = buildFileResults(status.files);
  if (!files.length) throw new Error('Offcloud returned no playable files');
  return files;
}

async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `oc:files:${scope(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await resolveSrc(apiKey, magnetLink);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `oc:files-turl:${scope(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await resolveSrc(apiKey, torrentUrl);
  await streamCache.set(cacheKey, files);
  return files;
}

async function getAccountInfo(apiKey: string) {
  const res = await axios.get(`${BASE_URL}/user/info`, {
    params: { key: apiKey },
    timeout: 15_000,
  });
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
