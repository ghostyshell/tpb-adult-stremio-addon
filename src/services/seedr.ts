/**
 * seedr.ts
 * Seedr.cc stream resolver.
 *
 * Two credential formats map to two Seedr APIs:
 *
 *   1. PAT (Personal Access Token, e.g. "sdp_...") - REST v2 at
 *      https://www.seedr.cc/api/v0.1/p/* with Authorization: Bearer.
 *      This is the only path that can transfer torrents on a non-premium
 *      account; the legacy /rest basic-auth API is premium-gated.
 *
 *   2. email:password - oauth_test v1: exchange at token.php for an
 *      access_token, then call resource.php with func=. Reads work on
 *      non-premium, but add_torrent is premium-gated (returns a v2-style
 *      404); we surface a clear error pointing the user at a PAT.
 *
 * Flow (both paths): add magnet -> poll until finished -> list folder ->
 * pick the video file(s) -> fetch a direct CDN url per file.
 */

import axios from 'axios';
import { streamCache } from '../utils/cache';
import { VIDEO_EXT, scopeKey, cachedResolve } from './debridUtils';
import { buildMagnet, fetchInfoHashFromTorrentUrl } from '../utils/torrent';

const V2_BASE     = 'https://www.seedr.cc/api/v0.1/p';
const V1_RESOURCE = 'https://www.seedr.cc/oauth_test/resource.php';
const V1_TOKEN    = 'https://www.seedr.cc/oauth_test/token.php';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 180_000;

interface FileResult { url: string; fileName: string; fileSize: number }

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** PATs have no "@"; email:password does. A raw access token has no "@" either
 *  and is treated as a PAT (will 401 on v2 if invalid). */
function isPat(creds: string): boolean { return !String(creds || '').includes('@'); }

/** Keep video files; fall back to all named files when none are flagged video. */
function pickVideo(files: any[]): any[] {
  const named = (files || []).filter((f) => f && f.id && f.name);
  const video = named.filter((f) => f.is_video === true || VIDEO_EXT.test(f.name));
  return video.length ? video : named;
}

// ── V2 (PAT) ─────────────────────────────────────────────────────────────────

function v2Auth(pat: string) { return { headers: { Authorization: `Bearer ${pat}` } }; }

async function v2AddMagnet(pat: string, magnet: string): Promise<number> {
  const res = await axios.post(`${V2_BASE}/tasks`, { torrent_magnet: magnet },
    { ...v2Auth(pat), timeout: 30_000, validateStatus: (s) => s < 500 });
  const d = res.data || {};
  if (d.wt && !d.user_torrent_id) throw new Error('Seedr queue full - torrent added to wishlist (free space too small)');
  if (!d.success || !d.user_torrent_id) throw new Error(`Seedr add failed: ${JSON.stringify(d)}`);
  return d.user_torrent_id;
}

/** Poll a task until finished; return its folder id. Throws on timeout/error. */
async function v2WaitFolder(pat: string, taskId: number): Promise<number> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let name = '';
  let finishedNoFolder = false;
  while (Date.now() < deadline) {
    const res = await axios.get(`${V2_BASE}/tasks/${taskId}`, { ...v2Auth(pat), timeout: 15_000 });
    const t = res.data?.task || {};
    name = t.name || name;
    if (t.state === 'error' || t.error) throw new Error(`Seedr task error: ${t.error || t.state}`);
    if (t.state === 'finished' || Number(t.progress) >= 100) {
      if (t.folder_created_id) return t.folder_created_id;
      finishedNoFolder = true;   // finished but no folder id - fall through to root lookup
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (!finishedNoFolder) throw new Error('Timed out waiting for Seedr task');
  // Finished without a folder id (rare): find the folder by task title in root.
  const res = await axios.get(`${V2_BASE}/fs/root/contents`, { ...v2Auth(pat), timeout: 15_000 });
  const match = (res.data?.folders || []).find((f: any) => f.path === name || f.name === name);
  if (!match) throw new Error('Seedr task finished but no folder was created');
  return match.id;
}

async function v2ListFiles(pat: string, folderId: number): Promise<any[]> {
  const url = folderId ? `${V2_BASE}/fs/folder/${folderId}/contents` : `${V2_BASE}/fs/root/contents`;
  const res = await axios.get(url, { ...v2Auth(pat), timeout: 15_000 });
  return res.data?.files || [];
}

async function v2FileUrl(pat: string, fileId: number): Promise<string> {
  const res = await axios.get(`${V2_BASE}/download/file/${fileId}/url`, { ...v2Auth(pat), timeout: 15_000 });
  if (!res.data?.url) throw new Error(`Seedr fetch_file failed: ${JSON.stringify(res.data)}`);
  return res.data.url;
}

async function v2Resolve(pat: string, magnet: string): Promise<FileResult[]> {
  const taskId   = await v2AddMagnet(pat, magnet);
  const folderId = await v2WaitFolder(pat, taskId);
  const files    = pickVideo(await v2ListFiles(pat, folderId));
  if (!files.length) throw new Error('Seedr returned no playable files');
  const out: FileResult[] = [];
  for (const f of files) {
    try {
      const url = await v2FileUrl(pat, f.id);
      out.push({ url, fileName: f.name, fileSize: Number(f.size) || 0 });
    } catch (e: any) { console.warn(`[seedr] resolve file ${f.id} failed: ${e.message}`); }
  }
  if (!out.length) throw new Error('Seedr: no video file could be resolved');
  return out;
}

// ── V1 (email:password) ───────────────────────────────────────────────────────

const v1TokenCache = new Map<string, { access_token: string; refresh_token?: string; expires_at: number }>();

async function v1Login(creds: string): Promise<string> {
  const k = scopeKey(creds);
  const cached = v1TokenCache.get(k);
  if (cached && cached.expires_at > Date.now() + 60_000) return cached.access_token;
  const i = String(creds).indexOf(':');
  if (i < 1) throw new Error('Seedr requires email:password or a PAT (sdp_...) in srKey');
  const res = await axios.post(V1_TOKEN, new URLSearchParams({
    grant_type: 'password', client_id: 'seedr_chrome',
    username: creds.slice(0, i), password: creds.slice(i + 1),
  }).toString(), { timeout: 20_000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const d = res.data || {};
  if (!d.access_token) throw new Error(`Seedr login failed: ${JSON.stringify(d)}`);
  v1TokenCache.set(k, {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Date.now() + (Number(d.expires_in) || 2592000) * 1000,
  });
  return d.access_token;
}

async function v1Post(access_token: string, func: string, data: Record<string, string>): Promise<any> {
  const res = await axios.post(V1_RESOURCE, new URLSearchParams({ access_token, func, ...data }).toString(),
    { timeout: 30_000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, validateStatus: (s) => s < 500 });
  return res.data;
}

/** Refresh an expired v1 access token via the refresh_token grant; re-login on failure. */
async function v1Refresh(creds: string): Promise<string> {
  const k = scopeKey(creds);
  const cached = v1TokenCache.get(k);
  if (cached?.refresh_token) {
    try {
      const res = await axios.post(V1_TOKEN, new URLSearchParams({
        grant_type: 'refresh_token', client_id: 'seedr_chrome', refresh_token: cached.refresh_token,
      }).toString(), { timeout: 20_000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (res.data?.access_token) {
        v1TokenCache.set(k, {
          access_token: res.data.access_token,
          refresh_token: res.data.refresh_token || cached.refresh_token,
          expires_at: Date.now() + (Number(res.data.expires_in) || 2592000) * 1000,
        });
        return res.data.access_token;
      }
    } catch (_) { /* fall through to a fresh password login */ }
  }
  v1TokenCache.delete(k);
  return v1Login(creds);
}

async function v1Func(creds: string, func: string, data: Record<string, string> = {}): Promise<any> {
  let access_token = await v1Login(creds);
  let body = await v1Post(access_token, func, data);
  if (body?.error === 'expired_token') {           // token expired mid-session -> refresh + retry once
    access_token = await v1Refresh(creds);
    body = await v1Post(access_token, func, data);
  }
  if (body?.error === 'access_denied') {
    throw new Error('Seedr access denied - check your email:password or use a Personal Access Token (sdp_)');
  }
  return body;
}

async function v1Resolve(creds: string, magnet: string): Promise<FileResult[]> {
  const add = await v1Func(creds, 'add_torrent', { torrent_magnet: magnet, folder_id: '-1' });
  if (add && (add.status_code === 404 || add.reason_phrase === 'Not Found')) {
    throw new Error('Seedr email:password could not add the torrent (non-premium accounts cannot transfer via the API). Generate a Personal Access Token at seedr.cc and use it as srKey instead.');
  }
  // Detect the NEW folder this transfer creates without name matching: Seedr
  // drops a finished torrent from torrents[] and surfaces it as a folders[] entry,
  // so snapshot root folder ids before the add and poll for a fresh one.
  const before = await v1Func(creds, 'list_contents', { content_type: 'folder', content_id: '0' });
  const seen = new Set((before?.folders || []).map((f: any) => f.id));
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let folderId = 0;
  while (Date.now() < deadline) {
    const root = await v1Func(creds, 'list_contents', { content_type: 'folder', content_id: '0' });
    const fresh = (root?.folders || []).find((f: any) => !seen.has(f.id));
    if (fresh) { folderId = fresh.id; break; }
    await sleep(POLL_INTERVAL_MS);
  }
  if (!folderId) throw new Error('Timed out waiting for Seedr transfer');
  const list = await v1Func(creds, 'list_contents', { content_type: 'folder', content_id: String(folderId) });
  const files = pickVideo(list?.files || []);
  if (!files.length) throw new Error('Seedr returned no playable files');
  const out: FileResult[] = [];
  for (const f of files) {
    try {
      const r = await v1Func(creds, 'fetch_file', { folder_file_id: String(f.id) });
      if (r?.url) out.push({ url: r.url, fileName: f.name, fileSize: Number(f.size) || 0 });
    } catch (e: any) { console.warn(`[seedr] fetch_file ${f.id} failed: ${e.message}`); }
  }
  if (!out.length) throw new Error('Seedr: no video file could be resolved');
  return out;
}

// ── public entry points ──────────────────────────────────────────────────────

async function resolveStreams(creds: string, infoHash: string, magnetLink: string): Promise<FileResult[]> {
  const cacheKey = `sr:files:${scopeKey(creds)}:${infoHash}`;
  return cachedResolve(streamCache, cacheKey, () => (isPat(creds) ? v2Resolve(creds, magnetLink) : v1Resolve(creds, magnetLink)));
}

/** Torrent-URL fallback: derive the infohash from the .torrent, build a magnet,
 *  and reuse the magnet path (both V1 and V2 accept magnets). */
async function resolveStreamsFromTorrentFile(creds: string, torrentUrl: string): Promise<FileResult[]> {
  // Hash the torrentUrl into the key so an embedded HTTP basic-auth credential
  // (http://user:pass@host/x.torrent) never reaches Redis verbatim before the
  // SSRF guard inside fetchInfoHashFromTorrentUrl gets a chance to reject it.
  const cacheKey = `sr:files-turl:${scopeKey(creds)}:${scopeKey(torrentUrl)}`;
  return cachedResolve(streamCache, cacheKey, async () => {
    const infoHash = await fetchInfoHashFromTorrentUrl(torrentUrl, undefined);
    if (!infoHash) throw new Error('Seedr: could not derive infohash from torrent URL');
    return isPat(creds) ? v2Resolve(creds, buildMagnet(infoHash, '')) : v1Resolve(creds, buildMagnet(infoHash, ''));
  });
}

async function getAccountInfo(creds: string) {
  if (isPat(creds)) {
    const res = await axios.get(`${V2_BASE}/fs/root/contents`, { ...v2Auth(creds), timeout: 15_000 });
    return res.data;
  }
  return v1Func(creds, 'get_settings');
}

export { resolveStreams, resolveStreamsFromTorrentFile, getAccountInfo };
