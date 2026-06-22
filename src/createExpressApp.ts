/**
 * Express API routes for the Stremio addon (no HTML pages).
 */

import path from 'path';
import express from 'express';
import { buildManifest, ADDON_VERSION } from './manifest';
import { parseConfig } from './utils/config';
import streamRouter from './routes/stream';
import favoritesRouter from './routes/favorites';
import profileRouter from './routes/profile';
import { globalLimiter, stremioLimiter } from './utils/rateLimit';
import { proxyStremioToGo } from './utils/stremioGo';
import * as redis from './utils/redis';
import { buildInstallInstances } from './lib/installBuilder';
import { setFlash } from './lib/flashStore';

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

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.use(globalLimiter);
  app.use('/api/favorites', express.json());
  app.use('/api/profile', express.json({ limit: '64kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '7d' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: ADDON_VERSION, timestamp: new Date().toISOString() });
  });

  app.use('/api/favorites', sameOriginOnly, favoritesRouter);
  app.use('/api/profile', profileRouter);

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

  app.post('/admin/flush-cat-cache', express.json(), async (req, res) => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return res.status(503).json({ error: 'ADMIN_TOKEN not configured' });
    if (req.headers['x-admin-token'] !== adminToken) {
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
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const manifest = await buildManifest(parseConfig(), baseUrl);
      res.json(manifest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[manifest] Error:', message);
      res.status(500).json({ error: 'Failed to build manifest' });
    }
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

  app.use('/:config', (req, res, next) => {
    req.addonConfig = parseConfig(configParam(req.params.config));
    next();
  });

  app.get('/:config/manifest.json', stremioLimiter, async (req, res) => {
    if (await proxyStremioToGo(req, res, '/manifest.json')) return;
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const manifest = await buildManifest(req.addonConfig!, baseUrl);
      res.json(manifest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[manifest] Error:', message);
      res.status(500).json({ error: 'Failed to build manifest' });
    }
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
