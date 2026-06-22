/**
 * pikpak.js
 * PikPak API client (refresh-token auth).
 *
 * Credentials: PikPak refresh token (starts with "os.") or base64-encoded
 * JSON { access_token, refresh_token } in pkKey.
 *
 * Flow:
 *   1. Refresh access token
 *   2. POST /drive/v1/files  (offline URL upload with magnet)
 *   3. Poll /drive/v1/tasks until task completes
 *   4. GET /drive/v1/files/{id} → medias[0].link.url
 */


import axios from 'axios';
import * as crypto from 'crypto';
import { streamCache } from '../utils/cache';

const API_HOST = 'api-drive.mypikpak.com';
const USER_HOST = 'user.mypikpak.com';
const CLIENT_ID = 'YNxT9w7GMdWvEOKa';
const CLIENT_SECRET = 'dbw2OtmVEeuUvIptb1Coyg';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180_000;

const VIDEO_EXT = /\.(mp4|mkv|avi|wmv|mov|m4v|ts|m2ts|flv|webm|mpg|mpeg|vob|ogm)$/i;

function scope(token: string) {
  return crypto.createHash('sha1').update(String(token || '')).digest('hex').slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTokenInput(raw: string) {
  const value = String(raw || '').trim();
  if (!value) throw new Error('PikPak requires a refresh token in pkKey');

  if (value.startsWith('os.')) {
    return { refreshToken: value };
  }

  try {
    const json = Buffer.from(value, 'base64').toString('utf8');
    const data = JSON.parse(json);
    if (data.refresh_token) {
      return {
        refreshToken: data.refresh_token,
        accessToken: data.access_token || '',
      };
    }
  } catch (_: any) {}

  throw new Error('PikPak pkKey must be a refresh token (os.…) or base64 JSON with refresh_token');
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await axios.post(`https://${USER_HOST}/v1/auth/token`, body.toString(), {
    timeout: 20_000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const accessToken = res.data?.access_token;
  const newRefresh = res.data?.refresh_token || refreshToken;
  if (!accessToken) throw new Error('PikPak token refresh failed');
  return { accessToken, refreshToken: newRefresh };
}

async function pkRequest(method: string, path: string, accessToken: string, data: any = null, params: any = null) {
  const res = await axios({
    method,
    url: `https://${API_HOST}${path}`,
    data,
    params,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  return res.data;
}

async function offlineDownload(accessToken: string, url: string) {
  return pkRequest('POST', '/drive/v1/files', accessToken, {
    kind: 'drive#file',
    upload_type: 'UPLOAD_TYPE_URL',
    url: { url },
    folder_type: 'DOWNLOAD',
  });
}

async function listOfflineTasks(accessToken: string) {
  return pkRequest('GET', '/drive/v1/tasks', accessToken, null, {
    type: 'offline',
    thumbnail_size: 'SIZE_SMALL',
    limit: 100,
    filters: JSON.stringify({ phase: { in: 'PHASE_TYPE_RUNNING,PHASE_TYPE_PENDING,PHASE_TYPE_COMPLETE' } }),
    with: 'reference_resource',
  });
}

async function getFile(accessToken: string, fileId: string) {
  return pkRequest('GET', `/drive/v1/files/${fileId}`, accessToken, null, {
    thumbnail_size: 'SIZE_LARGE',
  });
}

async function listFolderFiles(accessToken: string, parentId: string) {
  return pkRequest('GET', '/drive/v1/files', accessToken, null, {
    parent_id: parentId,
    thumbnail_size: 'SIZE_MEDIUM',
    limit: 200,
    filters: JSON.stringify({
      trashed: { eq: false },
      phase: { eq: 'PHASE_TYPE_COMPLETE' },
    }),
  });
}

function buildFileResults(entries: any[]) {
  const mapped = (entries || [])
    .map((f: any) => ({
      url: f.medias?.[0]?.link?.url || f.web_content_link || '',
      fileName: f.name || '',
      fileSize: Number(f.size) || 0,
    }))
    .filter((f: any) => f.url);

  const video = mapped.filter((f: any) => VIDEO_EXT.test(f.fileName));
  return video.length > 0 ? video : mapped;
}

async function waitForTask(accessToken: string, taskId: string, fileId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const tasks = await listOfflineTasks(accessToken);
    const task = (tasks.tasks || []).find((t: any) => t.id === taskId);
    if (task?.reference_resource?.phase === 'PHASE_TYPE_COMPLETE') {
      return task.reference_resource;
    }
    if (fileId) {
      try {
        const info = await getFile(accessToken, fileId);
        if (info?.phase === 'PHASE_TYPE_COMPLETE') return info;
      } catch (_: any) {}
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Timed out waiting for PikPak offline task');
}

async function collectFiles(accessToken: string, resource: any) {
  if (!resource) throw new Error('PikPak task produced no files');

  if (resource.kind === 'drive#folder' || resource.folder_type) {
    const list = await listFolderFiles(accessToken, resource.id);
    const files = buildFileResults(list.files || []);
    if (files.length) return files;
  }

  const direct = await getFile(accessToken, resource.id);
  const files = buildFileResults([direct]);
  if (!files.length) throw new Error('PikPak returned no playable files');
  return files;
}

async function resolveSrc(tokenInput: string, src: string) {
  const parsed = parseTokenInput(tokenInput);
  const { accessToken } = await refreshAccessToken(parsed.refreshToken);

  const created = await offlineDownload(accessToken, src);
  const taskId = created.task_id || created.id;
  const fileId = created.id || created.file_id;
  if (!taskId && !fileId) throw new Error('PikPak offline add failed');

  const resource = await waitForTask(accessToken, taskId, fileId);
  return collectFiles(accessToken, resource);
}

async function resolveStreams(tokenInput: string, infoHash: string, magnetLink: string) {
  const cacheKey = `pk:files:${scope(tokenInput)}:${infoHash}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await resolveSrc(tokenInput, magnetLink);
  await streamCache.set(cacheKey, files);
  return files;
}

async function resolveStreamsFromTorrentFile(tokenInput: string, torrentUrl: string) {
  const cacheKey = `pk:files-turl:${scope(tokenInput)}:${torrentUrl}`;
  const cached = await streamCache.get(cacheKey);
  if (cached) return cached;

  const files = await resolveSrc(tokenInput, torrentUrl);
  await streamCache.set(cacheKey, files);
  return files;
}

export { resolveStreams, resolveStreamsFromTorrentFile, };
