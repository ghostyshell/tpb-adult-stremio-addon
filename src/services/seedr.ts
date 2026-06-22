/**
 * seedr.js
 * Seedr.cc REST API v1 client.
 *
 * Credentials: email:password (stored in srKey).
 *
 * Flow:
 *   1. POST /rest/transfer/magnet
 *   2. Poll GET /rest/transfer/{id} until progress >= 100
 *   3. GET /rest/folder/{folder_id} → file list
 *   4. Stream via https://www.seedr.cc/rest/file/{file_id} (redirects to CDN)
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://www.seedr.cc/rest';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180_000;

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

function scope(creds: string) {
  return crypto.createHash('sha1').update(String(creds || '')).digest('hex').slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCreds(creds: string) {
  const i = String(creds || '').indexOf(':');
  if (i < 1) throw new Error('Seedr requires email:password in srKey');
  return { username: creds.slice(0, i), password: creds.slice(i + 1) };
}

function authConfig(creds: string) {
  const { username, password } = parseCreds(creds);
  return { auth: { username, password } };
}

function buildFileResults(files: any[]) {
  const mapped = (files || [])
    .map((f: any) => ({
      url: f.id ? `${BASE_URL}/file/${f.id}` : '',
      fileName: f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f: any) => f.url);

  const video = mapped.filter((f: any) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function addMagnet(creds: string, magnet: string) {
  const res = await axios.post(`${BASE_URL}/transfer/magnet`, new URLSearchParams({ magnet }).toString(), {
    ...authConfig(creds),
    timeout: 20_000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const id = res.data?.id || res.data?.transfer?.id;
  if (!id) throw new Error(`Seedr magnet add failed: ${JSON.stringify(res.data)}`);
  return String(id);
}

async function addTorrentUrl(creds: string, torrentUrl: string) {
  const res = await axios.post(`${BASE_URL}/transfer/url`, new URLSearchParams({ url: torrentUrl }).toString(), {
    ...authConfig(creds),
    timeout: 20_000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const id = res.data?.id || res.data?.transfer?.id;
  if (!id) throw new Error(`Seedr URL add failed: ${JSON.stringify(res.data)}`);
  return String(id);
}

async function getTransfer(creds: string, transferId: string) {
  const res = await axios.get(`${BASE_URL}/transfer/${transferId}`, {
    ...authConfig(creds),
    timeout: 15_000,
  });
  return res.data;
}

async function waitForTransfer(creds: string, transferId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await getTransfer(creds, transferId);
    const progress = Number(info?.progress ?? info?.percent ?? 0);
    if (progress >= 100) return info;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Seedr transfer');
}

async function listFolder(creds: string, folderId: string | null) {
  const path = folderId ? `folder/${folderId}` : 'folder';
  const res = await axios.get(`${BASE_URL}/${path}`, {
    ...authConfig(creds),
    timeout: 15_000,
  });
  return res.data;
}

function flattenFiles(node: any, out: any[] = []) {
  if (!node) return out;
  for (const f of node.files || []) out.push(f);
  for (const sub of node.folders || []) flattenFiles(sub, out);
  return out;
}

async function resolveTransfer(creds: string, transferId: string) {
  const transfer = await waitForTransfer(creds, transferId);
  const folderId = transfer.folder_id || transfer.folderid || transfer.folder?.id;
  const folder = folderId ? await listFolder(creds, folderId) : await listFolder(creds, null);
  const rawFiles = flattenFiles(folder);
  const files = buildFileResults(rawFiles);
  if (!files.length) throw new Error('Seedr returned no playable files');
  return files;
}

async function resolveStreams(creds: string, infoHash: string, magnetLink: string) {
  const cacheKey = `sr:files:${scope(creds)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const transferId = await addMagnet(creds, magnetLink);
  const files = await resolveTransfer(creds, transferId);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(creds: string, torrentUrl: string) {
  const cacheKey = `sr:files-turl:${scope(creds)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const transferId = await addTorrentUrl(creds, torrentUrl);
  const files = await resolveTransfer(creds, transferId);
  await streamCache.set(cacheKey, files);
  return files;
}

async function getAccountInfo(creds: string) {
  const res = await axios.get(`${BASE_URL}/user`, { ...authConfig(creds), timeout: 15_000 });
  return res.data;
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
