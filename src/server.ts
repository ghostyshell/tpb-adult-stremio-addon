/**
 * Custom server: Express API + Next.js configure/install UI.
 */

import next from 'next';
import * as mongo from './utils/mongo';
import * as redis from './utils/redis';
import { createExpressApp } from './createExpressApp';

const PORT = (() => {
  const raw = process.env.PORT;
  const n = raw !== undefined ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 7000;
})();

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: process.cwd() });
const handle = nextApp.getRequestHandler();

async function main() {
  if (!process.env.SESSION_SECRET && process.env.MONGODB_URI) {
    console.warn('[profile] SESSION_SECRET is not set - saved profiles will be unreadable after restart. Set a persistent random value in production (openssl rand -hex 32).');
  }
  await nextApp.prepare();
  const app = createExpressApp();

  app.get('/configure', (req, res) => handle(req, res));
  app.get('/configure/install', (req, res) => handle(req, res));
  app.all('/_next/*', (req, res) => handle(req, res));

  app.use((req, res) => {
    if (req.path.startsWith('/_next') || req.path.startsWith('/__next')) {
      return handle(req, res);
    }
    res.status(404).json({ error: 'Not found' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`TPB Porn Stremio Addon running on port ${PORT}`);
    console.log(`Configure at: http://localhost:${PORT}/configure`);
  });

  function shutdown(signal: string) {
    console.log(`[shutdown] ${signal} received; closing HTTP server`);
    server.close(async () => {
      try { await mongo.close(); } catch { /* best-effort */ }
      const rc = redis.client;
      if (rc != null && typeof rc.quit === 'function') {
        rc.quit().catch(() => {}).finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    setTimeout(() => process.exit(1), 250).unref();
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    setTimeout(() => process.exit(1), 250).unref();
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
