/**
 * megadebrid.js
 * Mega-Debrid.eu API client.
 *
 * Flow:
 *   1. POST api.php?action=uploadTorrent&token=…  (magnet or .torrent file)
 *   2. Poll POST getTorrent with hash until status === "complete"
 *   3. POST getLink on status.ub_link → debridLink
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const BASE_URL = 'https://www.mega-debrid.eu/api.php';
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 180_000;

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

function scope(apiKey: string) {
  return crypto.createHash('sha1').update(String(apiKey || '')).digest('hex').slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mgPost(action: string, token: string, fields: Record<string, string> = {}) {
  const params = new URLSearchParams({ ...fields });
  const res = await axios.post(`${BASE_URL}?action=${action}&token=${encodeURIComponent(token)}`, params.toString(), {
    timeout: 30_000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const body = res.data;
  if (body?.response_code !== 'ok') {
    throw new Error(`Mega-Debrid ${action} failed: ${body?.response_text || JSON.stringify(body)}`);
  }
  return body;
}

function hashFromMagnet(magnet: string) {
  const m = String(magnet).match(/btih:([a-fA-F0-9]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function buildFileResults(url: string, fileName = '', fileSize = 0) {
  const files = [{ url, fileName, fileSize }].filter((f) => f.url);
  const video = files.filter((f) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : files;
}

async function uploadMagnet(token: string, magnet: string) {
  const body = await mgPost('uploadTorrent', token, { magnet });
  const hash = body.newTorrent?.hash || hashFromMagnet(magnet);
  if (!hash) throw new Error('Mega-Debrid upload: no torrent hash');
  return { hash, name: body.newTorrent?.name || '', size: Number(body.newTorrent?.size) || 0 };
}

async function uploadTorrentFile(token: string, torrentUrl: string) {
  const fileRes = await axios.get(torrentUrl, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    headers: { 'User-Agent': 'stremio-addon/1.0' },
    maxRedirects: 5,
  });

  const form = new FormData();
  const blob = new Blob([fileRes.data], { type: 'application/x-bittorrent' });
  form.append('file', blob, 'torrent.torrent');

  const res = await axios.post(`${BASE_URL}?action=uploadTorrent&token=${encodeURIComponent(token)}`, form, {
    timeout: 30_000,
  });
  const body = res.data;
  if (body?.response_code !== 'ok') {
    throw new Error(`Mega-Debrid file upload failed: ${body?.response_text || JSON.stringify(body)}`);
  }
  const hash = body.newTorrent?.hash;
  if (!hash) throw new Error('Mega-Debrid file upload: no torrent hash');
  return { hash, name: body.newTorrent?.name || '', size: Number(body.newTorrent?.size) || 0 };
}

async function waitForComplete(token: string, hash: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const body = await mgPost('getTorrent', token, { hash });
    const status = body.status || {};
    if (status.status === 'complete' && status.ub_link) return status;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for Mega-Debrid torrent');
}

async function debridLink(token: string, link: string) {
  const body = await mgPost('getLink', token, { link });
  return body.debridLink || '';
}

async function resolveHash(token: string, hash: string, fallbackName = '', fallbackSize = 0) {
  const status = await waitForComplete(token, hash);
  const url = await debridLink(token, status.ub_link);
  if (!url) throw new Error('Mega-Debrid returned no debrid link');
  const name = status.name || fallbackName || '';
  const size = Number(status.size) || fallbackSize || 0;
  const files = buildFileResults(url, name, size);
  if (!files.length) throw new Error('Mega-Debrid returned no playable files');
  return files;
}

async function resolveStreams(apiKey: string, infoHash: string, magnetLink: string) {
  const cacheKey = `mg:files:${scope(apiKey)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const uploaded = await uploadMagnet(apiKey, magnetLink);
  const files = await resolveHash(apiKey, uploaded.hash, uploaded.name, uploaded.size);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(apiKey: string, torrentUrl: string) {
  const cacheKey = `mg:files-turl:${scope(apiKey)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const uploaded = await uploadTorrentFile(apiKey, torrentUrl);
  const files = await resolveHash(apiKey, uploaded.hash, uploaded.name, uploaded.size);
  await streamCache.set(cacheKey, files);
  return files;
}

async function getAccountInfo(apiKey: string) {
  return mgPost('getUserHistory', apiKey, { limit: '1' });
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo, };
