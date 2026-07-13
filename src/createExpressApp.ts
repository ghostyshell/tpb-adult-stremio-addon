/**
 * Express API routes for the Stremio addon (no HTML pages).
 */

import path from 'path';
import crypto from 'crypto';
import express from 'express';
import { ADDON_VERSION } from './manifest';
import { parseConfig } from './utils/config';
import streamRouter from './routes/stream';
import favoritesRouter from './routes/favorites';
import profileRouter from './routes/profile';
import { globalLimiter, stremioLimiter } from './utils/rateLimit';
import { proxyStremioToGo } from './utils/stremioGo';
import * as redis from './utils/redis';
import { buildInstallInstances } from './lib/installBuilder';
import { setFlash } from './lib/flashStore';
import { getPkey, refreshPkey } from './services/stripchatKeys';
import { fetchCam, getMaster, getVariants, parseVariants, rewriteM3u8Urls, fetchWithPkey, withPkeyParams, isAdvertPlaylist, ALLOWED_CDN_RE } from './services/stripchatHls';
import { decodeMouflonPlaylist, normalizeStripchatM3u8, resolveStripchatPdkey } from './services/stripchatMouflon';
import { isSafeUrl } from './utils/safeUrl';

function configParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function stremioSubpath(req: express.Request, section: string) {
  const prefix = `/${req.params.config}/${section}/`;
  const idx = req.originalUrl.indexOf(prefix);
  if (idx < 0) return '';
  let rest = req.originalUrl.slice(idx + prefix.length);
  const q = rest.indexOf('?');
  if (q >= 0) rest = rest.slice(0, q);
  return rest;
}

function sameOriginOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  const host = `${req.protocol}://${req.get('host')}`;
  const origin = req.headers.origin;
  if (!origin || origin === host) return next();
  return res.status(403).json({ error: 'Forbidden: cross-origin request not allowed' });
}

export function createExpressApp() {
  const app = express();

  const TRUST_PROXY_HOPS = (() => {
    const raw = process.env.TRUST_PROXY_HOPS;
    const n = raw !== undefined ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 5 ? n : 1;
  })();
  app.set('trust proxy', TRUST_PROXY_HOPS);

  // Security headers. On API/addon routes, CSP keeps script-src to 'self' and
  // frame-ancestors allows Stremio's web/desktop shells to embed /configure
  // while blocking arbitrary sites (clickjacking defense). The /configure and
  // /configure/install HTML pages are served by Next.js, which injects inline
  // __next_f flight scripts; proxy.ts generates a per-request nonce and sets a
  // nonce'd CSP for those, so skip the global CSP here to avoid a double CSP
  // header (two are ANDed, which would re-block the inline scripts).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    // Only the HTML-producing GETs are served by Next.js with inline scripts;
    // non-HTML responses on these paths (e.g. the POST -> 302 install redirect)
    // keep the plain CSP below so frame-ancestors stays set on every response.
    const isConfigurePage = req.method === 'GET' && (req.path === '/configure' || req.path === '/configure/install');
    // /stripchat/* serves media subresources (m3u8 playlists, mp4 segments),
    // not documents. CSP/frame-ancestors are document headers here; setting
    // frame-ancestors on the proxied m3u8 blocked Stremio's internal player
    // from loading the playlist ("loads but never plays"), while debrid
    // streams (external CDN URLs) were unaffected. Skip CSP on media proxies.
    const isMediaProxy = req.path.startsWith('/stripchat/');
    if (!isConfigurePage && !isMediaProxy) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https:; frame-ancestors https://web.stremio.com https://app.stremio.com https://stremio.com;",
      );
    }
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.use(globalLimiter);
  app.use('/api/favorites', express.json({ limit: '32kb' }));
  app.use('/api/profile', express.json({ limit: '64kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '7d' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: ADDON_VERSION, timestamp: new Date().toISOString() });
  });

  app.use('/api/favorites', sameOriginOnly, favoritesRouter);
  app.use('/api/profile', sameOriginOnly, profileRouter);

  app.get('/', (_req, res) => res.redirect('/configure'));

  const installBodyParser = express.urlencoded({ extended: false });

  function handleInstall(req: express.Request, res: express.Response) {
    const result = buildInstallInstances(req);
    const flashId = setFlash(result);
    res.cookie('install_flash_id', flashId, {
      httpOnly: true,
      maxAge: 120_000, // Express maxAge is in milliseconds; 120s matches the flash TTL
      sameSite: 'lax',
      path: '/',
    });
    res.redirect(302, '/configure/install');
  }

  app.post('/configure/install', installBodyParser, handleInstall);
  // GET with query params: legacy deep-link installs. Falls through to the
  // Next.js handler registered in server.ts when no query params are present.
  // Registration order matters: this handler must run before server.ts adds
  // the Next.js catch-all for /configure/install.
  app.get('/configure/install', (req, res, next) => {
    if (Object.keys(req.query).length > 0) {
      return handleInstall(req, res);
    }
    next();
  });

  app.post('/admin/flush-cat-cache', express.json({ limit: '4kb' }), async (req, res) => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return res.status(503).json({ error: 'ADMIN_TOKEN not configured' });
    // Constant-time compare to avoid a timing oracle on the admin token.
    const provided = String(req.headers['x-admin-token'] ?? '');
    const a = Buffer.from(provided);
    const b = Buffer.from(adminToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }
    try {
      const explicit = (req.body && typeof req.body.backendUrl === 'string') ? req.body.backendUrl : '';
      const prefix = explicit || (process.env.BACKEND_URL || '');
      if (!prefix) return res.status(400).json({ error: 'No backendUrl to match' });
      const fullPattern = `cat:v1:${prefix}|*`;
      const matched = await redis.scan(fullPattern, 10000);
      let deleted = 0;
      for (const k of matched) {
        await redis.del(k);
        deleted++;
      }
      console.log(`[admin] flushed ${deleted} cat:v1:* keys with prefix "${prefix}"`);
      res.json({ deleted, prefix });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[admin] flush error:', message);
      res.status(500).json({ error: message });
    }
  });

  const defaultConfig = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.addonConfig = parseConfig();
    next();
  };

  app.get('/manifest.json', stremioLimiter, async (req, res) => {
    // Unconfigured manifest: proxy the Go backend's default manifest. No local
    // fallback (Go is the single source of truth) - fail loud (502) on miss.
    if (await proxyStremioToGo(req, res, '/manifest.json', 'default')) return;
    res.status(502).json({ error: 'backend unavailable' });
  });

  app.use('/catalog', stremioLimiter, defaultConfig, async (req, res) => {
    const sub = req.url.replace(/^\//, '').split('?')[0];
    if (sub && await proxyStremioToGo(req, res, `/catalog/${sub}`, 'default')) return;
    res.json({ metas: [] });
  });

  app.use('/meta', stremioLimiter, defaultConfig, async (req, res) => {
    const sub = req.url.replace(/^\//, '').split('?')[0];
    if (sub && await proxyStremioToGo(req, res, `/meta/${sub}`, 'default')) return;
    res.json({ meta: null });
  });

  app.use('/stream', stremioLimiter, defaultConfig, streamRouter);

  // ── Stripchat HLS proxy ─────────────────────────────────────────────────
  // These routes are registered BEFORE the /:config catch-all so they get
  // priority over the generic config-prefixed handlers. They DO NOT use a
  // config prefix; the proxy is stateless (pkey auto-extracted).
  //
  // GET /stripchat/hls/:username/:quality
  //   Fetches a master or variant m3u8 with the current pkey appended,
  //   decrypts MOUFLON tags, and serves the playlist with direct CDN
  //   segment URLs. quality can be "auto" (master) or a resolution
  //   like "1920x1080".
  app.get('/stripchat/hls/:username/:quality', stremioLimiter, async (req, res) => {
    const username = String(req.params.username);
    const quality  = String(req.params.quality);
    if (!username || !quality) return res.status(400).json({ error: 'missing params' });

    try {
      const cam = await fetchCam(username);
      if (!cam || !cam.streamName) return res.status(404).json({ error: 'model not found' });

      const pkey = await getPkey(cam.streamName);
      if (!pkey) return res.status(503).json({ error: 'pkey not available' });

      let fetchRes: Response;
      let playlistUrl: string;
      if (quality === 'auto' || quality === 'source') {
        const variants = await getVariants(username, cam.streamName);
        const variant = variants[0];
        if (!variant) return res.status(404).json({ error: 'quality not found' });
        playlistUrl = variant.url;
        if (!/^https?:\/\//i.test(playlistUrl)) {
          playlistUrl = new URL(playlistUrl, 'https://edge-hls.doppiocdn.com/').href;
        }
        fetchRes = await fetchWithPkey(playlistUrl, pkey);
      } else {
        const variants = await getVariants(username, cam.streamName);
        const variant = variants.find((v) => v.name === quality) || variants[0];
        if (!variant) return res.status(404).json({ error: 'quality not found' });
        playlistUrl = variant.url;
        if (!/^https?:\/\//i.test(playlistUrl)) {
          playlistUrl = new URL(playlistUrl, 'https://edge-hls.doppiocdn.com/').href;
        }
        fetchRes = await fetchWithPkey(playlistUrl, pkey);
      }

      if (!fetchRes.ok) return res.status(502).json({ error: 'upstream fetch failed' });
      const raw = await fetchRes.text();
      if (isAdvertPlaylist(raw)) {
        refreshPkey(cam.streamName).catch(() => {});
        return res.status(502).json({ error: 'stale pkey' });
      }

      const pdkey = resolveStripchatPdkey(pkey);
      let body = decodeMouflonPlaylist(raw, pdkey);
      body = normalizeStripchatM3u8(body);
      const rewritten = rewriteM3u8Urls(body, playlistUrl);
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Cache-Control', 'no-cache');
      res.send(rewritten);
    } catch (err: any) {
      console.error('[stripchat/hls] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /stripchat/seg?url=<encoded>
  //   Fetches a segment or sub-playlist from the doppiocdn CDN. Playlists
  //   are fetched with pkey + recursively rewritten; segments are
  //   passthrough (no pkey needed). SSRF: only doppiocdn hosts allowed.
  app.get('/stripchat/seg', stremioLimiter, async (req, res) => {
    const segUrl = String(req.query.url || '').trim();
    if (!segUrl) return res.status(400).json({ error: 'missing url' });

    // SSRF guard: only allow doppiocdn CDN hosts.
    let parsed;
    try {
      parsed = new URL(segUrl);
    } catch { return res.status(400).json({ error: 'invalid url' }); }
    if (!ALLOWED_CDN_RE.test(parsed.hostname.toLowerCase())) {
      return res.status(403).json({ error: 'host not allowed' });
    }

    try {
      // Sub-playlist (*.m3u8): fetch with pkey + rewrite recursively.
      if (segUrl.endsWith('.m3u8') || segUrl.endsWith('.m3u')) {
        const pkey = await getPkey();
        if (!pkey) return res.status(503).json({ error: 'pkey not available' });
        const fullUrl = withPkeyParams(segUrl, pkey);
        const fetchRes = await fetch(fullUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://stripchat.com/', 'Origin': 'https://stripchat.com' },
        });
        if (!fetchRes.ok) return res.status(502).json({ error: 'upstream failed' });
        const raw = await fetchRes.text();
        if (isAdvertPlaylist(raw)) return res.status(502).json({ error: 'stale pkey' });
        const pdkey = resolveStripchatPdkey(pkey);
        let body = decodeMouflonPlaylist(raw, pdkey);
        body = normalizeStripchatM3u8(body);
        const rewritten = rewriteM3u8Urls(body, fullUrl);
        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.set('Cache-Control', 'no-cache');
        return res.send(rewritten);
      }

      // Segment / init segment: passthrough (no pkey needed).
      const segRes = await fetch(segUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://stripchat.com/', 'Origin': 'https://stripchat.com' },
      });
      if (!segRes.ok) return res.status(502).json({ error: 'segment fetch failed' });
      const ct = segRes.headers.get('Content-Type') || 'video/MP2T';
      const cl = segRes.headers.get('Content-Length');
      res.set('Content-Type', ct);
      if (cl) res.set('Content-Length', cl);
      if (segRes.body) {
        const { Readable } = await import('stream');
        // Handle upstream-abort so an unhandled stream error doesn't hang the
        // response (and in stricter runtimes, the process).
        Readable.fromWeb(segRes.body as any)
          .on('error', () => { try { res.destroy(); } catch {} })
          .pipe(res);
      } else {
        const buf = await segRes.arrayBuffer();
        res.send(Buffer.from(buf));
      }
    } catch (err: any) {
      console.error('[stripchat/seg] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/:config', (req, res, next) => {
    req.addonConfig = parseConfig(configParam(req.params.config));
    next();
  });

  app.get('/:config/manifest.json', stremioLimiter, async (req, res) => {
    // The Go backend is the single source of truth for the manifest. There is
    // no local fallback: if the proxy can't serve it, fail loud (502).
    if (await proxyStremioToGo(req, res, '/manifest.json')) return;
    res.status(502).json({ error: 'backend unavailable' });
  });

  app.get('/:config/configure', (_req, res) => {
    res.redirect(301, '/configure');
  });

  app.use('/:config/catalog', stremioLimiter, async (req, res) => {
    req.addonConfig = parseConfig(configParam(req.params.config));
    const sub = stremioSubpath(req, 'catalog');
    if (sub && await proxyStremioToGo(req, res, `/catalog/${sub}`)) return;
    res.json({ metas: [] });
  });

  app.use('/:config/meta', stremioLimiter, async (req, res) => {
    req.addonConfig = parseConfig(configParam(req.params.config));
    const sub = stremioSubpath(req, 'meta');
    if (sub && await proxyStremioToGo(req, res, `/meta/${sub}`)) return;
    res.json({ meta: null });
  });

  app.use('/:config/stream', stremioLimiter, (req, res, next) => {
    req.addonConfig = parseConfig(configParam(req.params.config));
    next();
  }, streamRouter);

  return app;
}

export default createExpressApp;
