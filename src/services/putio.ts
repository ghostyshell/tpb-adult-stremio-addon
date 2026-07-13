/**
 * putio.js
 * Put.io API client.
 *
 * Flow:
 *   1. POST /v2/transfers/add  (oauth_token + url)
 *   2. Poll GET /v2/transfers/{id} until status is SEEDING or COMPLETED
 *   3. GET /v2/files/list?parent_id={folder_id}
 *   4. GET /v2/files/{file_id}/url for each video file
 */


import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, scopeKey, cachedResolve } from './debridUtils';

const BASE_URL = 'https://api.put.io/v2';
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 180_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function puGet(apiKey: string, path: string, params = {}) {
  const res = await axios.get(`${BASE_URL}${path}`, {
    params: { oauth_token: apiKey, ...params },
    timeout: 15_000,
  });
  return res.data;
}

async function puPost(apiKey: string, path: string, data: Record<string, string> = {}) {
  const body = new URLSearchParams({ oauth_token: apiKey, ...data });
  const res = await axios.post(`${BASE_URL}${path}`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20_000,
  });
  return res.data;
}

async function addTransfer(apiKey: string, url: string) {
  const data = await puPost(apiKey, '/transfers/add', { url });
  const transfer = data.transfer;
  if (!transfer?.id) throw new Error('Put.io transfer add failed');
  return transfer.id;
}

async function waitForTransfer(apiKey: string, transferId: string | number) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const data = await puGet(apiKey, `/transfers/${transferId}`);
    const transfer = data.transfer;
    const status = (transfer?.status || '').toUpperCase();

    if (status === 'SEEDING' || status === 'COMPLETED') return transfer;
    if (['ERROR', 'CANCELLED'].includes(status)) {
      throw new Error(`Put.io transfer entered state: ${status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Put.io transfer');
}

async function listFolderFiles(apiKey: string, folderId: string | number) {
  const data = await puGet(apiKey, '/files/list', { parent_id: folderId });
  return data.files || [];
}

async function getFileUrl(apiKey: string, fileId: string | number) {
  const data = await puGet(apiKey, `/files/${fileId}/url`);
  return data.url || '';
}

function buildFileResults(rawFiles: any[]) {
  const mapped = (rawFiles || [])
    .map((f: any) => ({
      url: f.url || '',
      fileName: f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f: any) => f.url);

  const video = mapped.filter((f: any) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function resolveTransfer(apiKey: string, transferId: string | number) {
  const transfer = await waitForTransfer(apiKey, transferId);
  const folderId = transfer.file_id;
  if (!folderId) throw new Error('Put.io transfer has no folder id');

  const files = await listFolderFiles(apiKey, folderId);
  const wanted = files.filter((f: any) => VIDEO_EXT.test(f.name || ''));
  const targets = wanted.length ? wanted : files;

  const out: any[] = [];
  for (const f of targets) {
    const url = await getFileUrl(apiKey, f.id).catch(() => '');
    if (url) out.push({ url, fileName: f.name || '', fileSize: f.size || 0 });
  }
  if (!out.length) throw new Error('Put.io returned no playable files');
  return out;
}

async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `pu:files:${scopeKey(apiKey)}:${infoHash}`;
  return cachedResolve(streamCache, cacheKey, async () => {
    const transferId = await addTransfer(apiKey, magnetLink);
    return resolveTransfer(apiKey, transferId);
  });
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `pu:files-turl:${scopeKey(apiKey)}:${torrentUrl}`;
  return cachedResolve(streamCache, cacheKey, async () => {
    const transferId = await addTransfer(apiKey, torrentUrl);
    return resolveTransfer(apiKey, transferId);
  });
}

async function getAccountInfo(apiKey: string) {
  return puGet(apiKey, '/account/info');
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
