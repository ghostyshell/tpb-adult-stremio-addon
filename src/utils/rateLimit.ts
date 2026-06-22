/**
 * rateLimit.js
 * Per-IP rate limiting + a broad DDoS backstop for the addon.
 *
 * Two layers:
 *   - globalLimiter  : app-wide flood protection on every path (except /health).
 *                      High ceiling - only trips on abusive request floods.
 *   - stremioLimiter : generous per-IP limit for the Stremio resource endpoints
 *                      (manifest / catalog / meta / stream). A single Stremio
 *                      session legitimately fires many requests when the Home /
 *                      Search screens load, so this is intentionally lenient.
 *
 * All limits key on req.ip, which is only trustworthy when `trust proxy` is set
 * to the real number of proxy hops (see index.js). All values are env-tunable.
 */


import rateLimit from 'express-rate-limit';

const num = (value: string | undefined, fallback: number): number => {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Shared sliding window for every limiter (default 1 minute).
const WINDOW_MS = num(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000);

// Generous per-IP cap for Stremio resource endpoints.
const STREMIO_MAX = num(process.env.RATE_LIMIT_STREMIO_MAX, 300);

// App-wide DDoS backstop - higher ceiling, covers every path.
const GLOBAL_MAX = num(process.env.RATE_LIMIT_GLOBAL_MAX, 600);

const common = {
  windowMs: WINDOW_MS,
  standardHeaders: true,  // emit RateLimit-* headers
  legacyHeaders: false,   // disable deprecated X-RateLimit-* headers
  message: { error: 'Too many requests - please slow down.' },
};

const globalLimiter = rateLimit({
  ...common,
  max: GLOBAL_MAX,
  // Never throttle health checks (uptime monitors / load balancers).
  skip: (req) => req.path === '/health',
});

const stremioLimiter = rateLimit({
  ...common,
  max: STREMIO_MAX,
});

// Profile save: tight cap - writing encrypted API keys to MongoDB.
const profileSaveLimiter = rateLimit({ ...common, max: 10 });

// Profile load/delete: slightly looser.
const profileLoadLimiter = rateLimit({ ...common, max: 30 });

export { globalLimiter, stremioLimiter, profileSaveLimiter, profileLoadLimiter, WINDOW_MS, STREMIO_MAX, GLOBAL_MAX };
