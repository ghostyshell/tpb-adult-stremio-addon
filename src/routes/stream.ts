/**
 * stream.js
 * Stremio stream handler.
 *
 * Handles:   GET /{config}/stream/{type}/{id}.json
 *
 * For IDs starting with "jstrm:":
 *   Resolves via the configured debrid provider (if any), then falls back to P2P.
 *
 * Real-Debrid and TorBox forward the end user's public IP to their APIs so
 * CDN links are minted for the viewer, not this server.
 */

'use strict';

import type { Request, Response } from 'express';
import type { AddonConfig } from '../types/config';
import type { DebridFile, DebridProvider } from '../types/debrid';
import type { StremioStream } from '../types/stremio';

const { Router } = require('express');
const { formatBytes } = require('../services/realdebrid');
const { getActiveProvider, hasDebridKey } = require('../utils/debridProviders');
const { decodeItemId, decodeGroupId, encodeItemId, buildMagnet, qualityTag, detectQuality, encodeMediaFlowProxyUrl } = require('../utils/torrent');
const { isSafeUrl } = require('../utils/safeUrl');
const { getTorrent } = require('../utils/torrentCache');
const { stripchatStreams } = require('../services/stripchatHls');
const { fetchGoStreams } = require('../utils/stremioGo');

const router = Router();

// Interactive resolve budget - uncached RD downloads continue in the background.
const DEBRID_RESOLVE_TIMEOUT_MS = 22_000;

const prewarmInFlight = new Set();

function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value: T) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); },
    );
  });
}

router.get('/:type/:id.json', handleStream);

const EXTRA_INDEXER_WEBSITES = new Set(['knaben', 'xxxclub']);

const QUALITY_RANK: Record<string, number> = { '2160p': 3, '1080p': 2, '720p': 1 };

// When the item came from a quality-scoped catalog, drop streams whose
// resolution doesn't match that catalog.
//   fhd = 1080p catalog (drop 2160p/720p); 4k = 2160p catalog (drop 1080p/720p).
// ponytail: skip resolution-scope filter for extra indexers - they surface mixed
// quality and users opt in knowing that. No 480p floor: a 480p-only scene (e.g.
// a stashdb/porndb entry whose only torrent is 480p) would otherwise show no
// streams at all. detectQuality still ranks 480p last in the sort below.
function applyQualityFilter(streams: object[], id: string): object[] {
  const record = decodeItemId(id);
  const targetQ = String(record?.q || '');
  const isExtraIndexer = EXTRA_INDEXER_WEBSITES.has(String(record?.w || ''));
  const filtered = streams.filter((s: any) => {
    const q = detectQuality(s.name || '');
    if (!isExtraIndexer) {
      if (targetQ === 'fhd' && (q === '2160p' || q === '720p')) return false;
      if (targetQ === '4k'  && (q === '1080p' || q === '720p')) return false;
    }
    return true;
  });
  return filtered.sort((a: any, b: any) => {
    const ra = QUALITY_RANK[detectQuality(a.name || '')] ?? 0;
    const rb = QUALITY_RANK[detectQuality(b.name || '')] ?? 0;
    return rb - ra;
  });
}

async function handleStream(req: Request, res: Response) {
  const id = String(req.params['id']);
  const cfg = req.addonConfig;
  if (!cfg) return res.json({ streams: [] });
  const debridOn = hasDebridKey(cfg);

  // Hentai (Phase D): the Go backend self-scrapes HentaiMama (hmm-) and
  // resolves episode streams to direct mp4 URLs. Proxy hs:/hmm- ids straight
  // to Go's stream handler; no debrid (direct URLs). Legacy hs: ids don't map
  // to Mongo docs, so Go returns an empty list for them (old bookmarks get
  // "no streams") - acceptable, deprecated. (HentaiTV htv- was removed.)
  if (id.startsWith('hs:') || id.startsWith('hmm-')) {
    const raw = await fetchGoStreams(cfg, String(req.params['type']) || 'Porn', id).catch(() => []);
    return res.json({ streams: applyQualityFilter(raw, id) });
  }

  // TPDB (porndb:) and StashDB (stash:) scene ids both resolve to infoHashes on
  // the Go backend (ServeStremioStream routes both prefixes through tpdbStreams),
  // so fan them through the same porndbStreams path: debrid when configured, P2P
  // magnet otherwise. Without the stash: branch here, Stremio installs hitting the
  // edge got {streams:[]} for every stashdb entry (the backend resolved them fine;
  // the edge just never asked).
  if (id.startsWith('porndb:') || id.startsWith('stash:')) {
    const streams = await porndbStreams(cfg, id, String(req.params['type']), getActiveProvider(cfg), publicClientIp(req), debridOn).catch(() => []);
    return res.json({ streams: applyQualityFilter(streams, id) });
  }

  if (id.startsWith('sc:')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const streams = await stripchatStreams(cfg, id, baseUrl).catch(() => []);
    return res.json({ streams });
  }

  if (!id.startsWith('jstrm:') && !id.startsWith('jstrg:')) {
    return res.json({ streams: [] });
  }

  const userIp = publicClientIp(req);
  const provider = getActiveProvider(cfg);
  const contentType = String(req.params['type'] || 'Porn');

  try {
    // Compact studio catalog entry: one jstrg: id encodes the 4K and 1080p
    // variants of a scene as a JSON array. Re-encode each member back into a
    // jstrm: id and resolve it through the normal per-record path, so the
    // user sees one stream per quality. Per-member quality filtering still
    // applies (each member id carries its own q scope).
    if (id.startsWith('jstrg:')) {
      const records = decodeGroupId(id);
      if (!records || records.length === 0) return res.json({ streams: [] });
      const perMember = await Promise.all(records.map((r: Record<string, unknown>) =>
        resolveOneRecord(cfg, encodeItemId(r), provider, userIp, debridOn, contentType)));
      const flat = perMember.flat() as StremioStream[];
      flat.sort((a, b) => (QUALITY_RANK[detectQuality(b.name || '')] ?? 0) - (QUALITY_RANK[detectQuality(a.name || '')] ?? 0));
      return res.json({ streams: flat });
    }

    const streams = await resolveOneRecord(cfg, id, provider, userIp, debridOn, contentType);
    res.json({ streams });
  } catch (err: any) {
    console.error(`[stream] Error resolving streams for ${id}:`, err.message);
    res.json({ streams: [] });
  }
}

// resolveOneRecord resolves a single jstrm: id into streams (debrid when a
// provider is configured, else P2P magnet), applying the per-record quality
// filter. Extracted so the jstrg: group path can reuse it per member.
async function resolveOneRecord(cfg: any, id: string, provider: any, userIp: string | undefined, debridOn: boolean, contentType = 'Porn'): Promise<object[]> {
  try {
    // Un-enriched PornRips items carry only a detail URL (no infoHash). The Go
    // backend is now Mongo-only, so it returns streams:[] for these until the
    // background PornripsSync job backfills the hash - skip the backend round-
    // trip and return empty directly. Enriched items (payload has h) fall
    // through to the fast debrid/P2P path below.
    const record = decodeItemId(id);
    if (record?.w === 'pornrips' && !record?.h) {
      return applyQualityFilter([], id);
    }

    let streams: object[] = [];

    if (provider) {
      const debridStreams = await withTimeout(
        streamsForCustomId(cfg, id, provider, userIp),
        DEBRID_RESOLVE_TIMEOUT_MS,
        'debrid stream resolution',
      ).catch((err: any) => {
        console.error(`[stream] Debrid failed for ${id}:`, err.message);
        return [];
      });

      const p2pStreams = (!(cfg.hideP2P && debridOn))
        ? await torrentStreams(id).catch(() => [])
        : [];

      if (debridStreams.length === 0 && provider) {
        scheduleDebridPrewarm(provider, cfg, id, userIp);
      }

      streams = debridStreams.length > 0
        ? [...debridStreams, ...p2pStreams]
        : p2pStreams;
    } else if (!(cfg.hideP2P && debridOn)) {
      streams = await torrentStreams(id);
    }

    // Filter by quality: when the item came from a quality-scoped catalog, drop
    // streams that don't match that catalog's resolution (480p sinks via sort).
    return applyQualityFilter(streams, id);
  } catch (err: any) {
    console.error(`[stream] Error resolving streams for ${id}:`, err.message);
    if (!(cfg.hideP2P && debridOn)) {
      try { return applyQualityFilter(await torrentStreams(id), id); } catch (_) {}
    }
    return [];
  }
}

// ── Direct torrent (P2P) streaming ───────────────────────────────────────────

async function torrentStreams(id: string) {
  const record = decodeItemId(id);
  if (!record) return [];

  const stored   = await getTorrent(id);
  const infoHash = String(record.h || stored?.infoHash || '').toLowerCase();
  const title    = String(record.t || stored?.title || 'Unknown');

  // PornRips items without an infoHash are routed through the Go backend in
  // resolveOneRecord before this function is reached, so by here a PornRips
  // item must already carry a hash (enriched) - otherwise there's nothing to stream.
  if (!infoHash) return [];

  const magnet = stored?.magnetLink || buildMagnet(infoHash, title);

  const qt = qualityTag(title);
  const descParts = [title];
  if (stored?.size)    descParts.push(stored.size);
  if (stored?.seeders) descParts.push(`${stored.seeders} seeds`);

  return [{
    name:        qt && qt !== 'Unknown' ? `🧲 Torrent ${qt}` : '🧲 Torrent',
    description: descParts.filter(Boolean).join('\n'),
    infoHash,
    sources:     magnetSources(magnet, infoHash),
    behaviorHints: { bingeGroup: `jstrm-${infoHash}` },
  }];
}

// ── Proxied external sources ─────────────────────────────────────────────────

/**
 * ThePornDB catalog items: Go resolves performer → PornRips infoHashes; this
 * edge resolves each hash through debrid.
 */
async function porndbStreams(cfg: AddonConfig, id: string, contentType: string, provider: DebridProvider | null, userIp: string | undefined, debridOn: boolean) {
  const raw = await fetchGoStreams(cfg, contentType || 'Porn', id);
  const out = [];
  for (const s of raw) {
    const infoHash = String(s.infoHash || '').toLowerCase();
    if (!/^[a-f0-9]{40}$/.test(infoHash)) continue;
    const title = String(s.title || s.name || '').replace(/\r?\n/g, ' ').trim();
    const qt = qualityTag(title);

    let debridStreams = [];
    if (provider) {
      // Cold TorBox cache can take up to 120s (POLL_TIMEOUT_MS in torbox.ts);
      // cap so the P2P fallback below appears within a few seconds instead
      // of leaving the user on "Finding streams..." for two minutes.
      debridStreams = await withTimeout(
        debridStreamsForHash(cfg, provider, userIp, infoHash, title),
        DEBRID_RESOLVE_TIMEOUT_MS,
        'debrid stream resolution',
      ).catch((err: any) => {
        console.warn(`[stream] debrid resolution timed out or failed for "${title}": ${err.message}`);
        return [];
      });
      out.push(...debridStreams);
    }
    if (debridStreams.length === 0 && !(cfg.hideP2P && debridOn)) {
      const p2p = p2pStream(infoHash, title);
      if (s.name === 'PRT' && qt && qt !== 'Unknown') {
        p2p.name = `🧲 PRT ${qt}`;
      } else if (s.name === 'PRT') {
        p2p.name = '🧲 PRT';
      }
      out.push(p2p);
    }
  }
  return out;
}

/** Resolve a single infoHash through a debrid provider into playable streams. */
async function debridStreamsForHash(cfg: AddonConfig, provider: DebridProvider, userIp: string | undefined, infoHash: string, title: string) {
  const apiKey = cfg[provider.field as keyof AddonConfig] as string;
  const ipArg  = provider.usesIp ? userIp : undefined;
  try {
    const files = await provider.resolve(apiKey, infoHash, debridMagnet(infoHash, title), ipArg);
    return filesToStreams(files, { title, infoHash }, provider.tag, cfg);
  } catch (err: any) {
    console.error(`[stream] ${provider.tag} resolution failed for "${title}":`, err.message);
    return [];
  }
}

/** Build a direct-magnet P2P stream entry for an infoHash. */
function p2pStream(infoHash: string, title: string): { name: string; description: string | undefined; infoHash: string; sources: string[]; behaviorHints: { bingeGroup: string } } {
  const qt = qualityTag(title);
  return {
    name:        qt && qt !== 'Unknown' ? `🧲 Torrent ${qt}` : '🧲 Torrent',
    description: title || undefined,
    infoHash,
    sources:     magnetSources(buildMagnet(infoHash, title), infoHash),
    behaviorHints: { bingeGroup: `jstrm-${infoHash}` },
  };
}

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
];

function magnetSources(magnet: string, infoHash: string): string[] {
  const trackers = new Set(DEFAULT_TRACKERS);
  for (const m of magnet.matchAll(/tr=([^&]+)/g)) {
    try { trackers.add(decodeURIComponent(m[1])); } catch (_) {}
  }
  const sources = [...trackers].map((t) => `tracker:${t}`);
  sources.push(`dht:${infoHash}`);
  return sources;
}

/**
 * Magnet sent to debrid providers: include trackers so a cache miss that the
 * provider then downloads can find peers. Cache hits match by infohash and
 * ignore trackers. P2P sources add trackers separately via magnetSources.
 */
function debridMagnet(infoHash: string, title: string): string {
  const tr = DEFAULT_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return `${buildMagnet(infoHash, title)}${tr}`;
}

// ── Custom jstrm: ID ─────────────────────────────────────────────────────────

async function streamsForCustomId(cfg: AddonConfig, id: string, provider: DebridProvider, userIp: string | undefined) {
  const record = decodeItemId(id);
  if (!record) return [];

  const stored     = await getTorrent(id);
  let infoHash     = String(record.h || stored?.infoHash || '').toLowerCase();
  const title      = String(record.t || stored?.title || 'Unknown');
  let torrentUrl   = String(record.u || stored?.torrentUrl || '');
  const detailUrl  = String(record.d || stored?.detailUrl || '');
  const website    = String(record.w || stored?.website || '');
  const isSb       = isSukebeiItem(website, torrentUrl, detailUrl);

  const apiKey = cfg[provider.field as keyof AddonConfig] as string;
  const ipArg  = provider.usesIp ? userIp : undefined;
  const meta   = { title, infoHash, ...stored };

  const resolveFn = provider.resolveQuick || provider.resolve;
  const resolveFileFn = provider.resolveFileQuick || provider.resolveFile;

  const tryDebridMagnet = async (hash: string, magnet: string): Promise<object[]> => {
    if (!hash) return [];
    try {
      const files = await resolveFn(apiKey, hash, magnet, ipArg);
      if (!files || !files.length) return [];
      return filesToStreams(files, { ...meta, infoHash: hash }, provider.tag, cfg);
    } catch (err: any) {
      console.error(`[stream] ${provider.tag} resolution failed for "${title}":`, err.message);
      return [];
    }
  };

  const tryDebridTorrentFile = async (url: string): Promise<object[]> => {
    if (!url || !hasDirectTorrentUrl(url) || !resolveFileFn) return [];
    const safe = isSafeUrl(url);
    if (!safe.ok) {
      console.warn(`[stream] unsafe torrentUrl rejected for "${title}": ${safe.reason}`);
      return [];
    }
    try {
      const files = await resolveFileFn(apiKey, url, ipArg);
      if (!files || !files.length) return [];
      return filesToStreams(files, meta, provider.tag, cfg);
    } catch (err: any) {
      console.error(`[stream] ${provider.tag} torrent upload failed for "${title}":`, err.message);
      return [];
    }
  };

  // Prefer magnet when we have an infoHash so RD reuses the same torrent row and
  // streamCache keys stay aligned with background prewarm. Fall back to .torrent
  // upload only when the id has no hash.
  if (isSb) {
    if (infoHash) {
      const magnet = stored?.magnetLink || debridMagnet(infoHash, title);
      const magnetStreams = await tryDebridMagnet(infoHash, magnet);
      if (magnetStreams.length) return magnetStreams;
    }
    const fileStreams = await tryDebridTorrentFile(torrentUrl);
    if (fileStreams.length) return fileStreams;
    return [];
  }

  if (infoHash) {
    const magnet = stored?.magnetLink || debridMagnet(infoHash, title);
    const streams = await tryDebridMagnet(infoHash, magnet);
    if (streams.length) return streams;
  }

  // PornRips items without an infoHash are routed through the Go backend in
  // resolveOneRecord before this debrid path is reached, so by here a PornRips
  // item must already carry a hash. The remaining no-hash branch covers Sukebei
  // .torrent file uploads.
  if (!torrentUrl) return [];

  return tryDebridTorrentFile(torrentUrl);
}

function hasDirectTorrentUrl(url: unknown): boolean {
  return /\.torrent(\?|$)/i.test(String(url || ''));
}

function isSukebeiItem(website: unknown, torrentUrl: unknown, detailUrl: unknown): boolean {
  return website === 'sukebei'
    || /sukebei\.nyaa\.si/i.test(String(torrentUrl || ''))
    || /sukebei\.nyaa\.si/i.test(String(detailUrl || ''));
}

function scheduleDebridPrewarm(provider: DebridProvider, cfg: AddonConfig, id: string, userIp: string | undefined) {
  if (typeof provider.prewarm !== 'function') return;
  const record = decodeItemId(id);
  if (!record) return;

  const infoHash = String(record.h || '').toLowerCase();
  const torrentUrl = String(record.u || '');
  const title = String(record.t || '') || 'Unknown';
  const key = `${provider.field}:${infoHash || torrentUrl}`;
  if (!key || prewarmInFlight.has(key)) return;
  prewarmInFlight.add(key);

  const apiKey = cfg[provider.field as keyof AddonConfig] as string;
  const ipArg = provider.usesIp ? userIp : undefined;
  const magnet = debridMagnet(infoHash, title);
  const preferTorrent = isSukebeiItem(record.w, torrentUrl, record.d) && hasDirectTorrentUrl(torrentUrl);

  const useTorrent = preferTorrent && !infoHash;
  // SSRF defense: the sync path (tryDebridTorrentFile) validates torrentUrl via
  // isSafeUrl, but the background prewarm fetched it directly. Validate here too
  // so a crafted jstrm id pointing at an internal URL can't make the addon fetch
  // 169.254.169.254 / localhost / internal services and forward the body to the
  // user's debrid provider.
  if (useTorrent) {
    const safe = isSafeUrl(torrentUrl);
    if (!safe.ok) {
      console.warn(`[stream] unsafe prewarm torrentUrl rejected for "${title}": ${safe.reason}`);
      return;
    }
  }
  provider.prewarm(apiKey, infoHash, magnet, ipArg, useTorrent ? torrentUrl : '')
    .finally(() => prewarmInFlight.delete(key));
}

function filesToStreams(
  files: DebridFile[],
  t: { title?: string; infoHash?: string; size?: string; seeders?: number },
  tag = 'RD',
  cfg: AddonConfig,
) {
  if (!files || !files.length) return [];
  const multi = files.length > 1;
  return files.map((f: DebridFile) => {
    const qt   = qualityTag(f.fileName || t.title || '');
    const size = f.fileSize ? formatBytes(f.fileSize) : (t.size || '');
    const descParts: string[] = [];
    if (multi && f.fileName) descParts.push(f.fileName);
    if (size)      descParts.push(size);
    if (t.seeders) descParts.push(`${t.seeders} seeds`);

    let streamUrl = f.url;
    if (cfg?.proxyDebridStreams && cfg?.mediaFlowProxyUrl && cfg?.mediaFlowApiPassword) {
      const responseHeaders: Record<string, string> = {
        'content-disposition': `attachment, filename=${f.fileName || t.title || 'video'}`,
      };
      const fileExt = (f.fileName || '').match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
      if (fileExt) {
        const contentTypeMap: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.mkv': 'video/x-matroska',
          '.avi': 'video/x-msvideo',
          '.mov': 'video/quicktime',
          '.wmv': 'video/x-ms-wmv',
          '.webm': 'video/webm',
          '.m4v': 'video/x-m4v',
        };
        if (contentTypeMap[fileExt]) {
          responseHeaders['Content-Type'] = contentTypeMap[fileExt];
        }
      }
      streamUrl = encodeMediaFlowProxyUrl(
        cfg.mediaFlowProxyUrl,
        f.url,
        cfg.mediaFlowApiPassword,
        responseHeaders,
      );
    }

    return {
      url:         streamUrl,
      name:        `[${tag}] ${qt}`,
      description: descParts.join('\n') || f.fileName || t.title || '',
      behaviorHints: {
        notWebReady: false,
        bingeGroup:  `jstrm-${t.infoHash || ''}`,
        ...(f.fileName ? { filename: f.fileName } : {}),
      },
    };
  });
}

// ── Client IP ─────────────────────────────────────────────────────────────────

const PRIVATE_IPV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function publicClientIp(req: Request): string | undefined {
  let ip = (req.ip || '').trim();
  if (!ip) return undefined;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1' || ip === '::') return undefined;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return undefined;
  if (ip.startsWith('fe80')) return undefined;
  if (PRIVATE_IPV4.test(ip)) return undefined;
  return ip;
}

export default router;
