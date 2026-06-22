/**
 * profile.ts
 * Express routes for saving and loading user config profiles.
 *
 *   POST   /api/profile/save   { identifier, config } → { ok: true }
 *   POST   /api/profile/load   { identifier }         → { config }
 *   DELETE /api/profile        { identifier }         → { ok: true }
 */

import { Router } from 'express';
import { profilesAvailable, saveProfile, loadProfile, deleteProfile } from '../utils/profileStore';
import { profileSaveLimiter, profileLoadLimiter } from '../utils/rateLimit';

const router = Router();

const MAX_PROFILE_BYTES = 64 * 1024;

function getIdentifier(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const id = (body as Record<string, unknown>).identifier;
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (trimmed.length < 4 || trimmed.length > 200) return null;
  return trimmed;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

router.post('/save', profileSaveLimiter, async (req, res) => {
  if (!profilesAvailable()) return res.status(503).json({ error: 'Profile storage unavailable - MONGODB_URI is not configured.' });
  const identifier = getIdentifier(req.body);
  if (!identifier) return res.status(400).json({ error: 'identifier must be a string between 4 and 200 characters.' });
  const config = (req.body as Record<string, unknown>).config;
  if (!isPlainObject(config)) return res.status(400).json({ error: 'config must be a plain object.' });
  if (Buffer.byteLength(JSON.stringify(config), 'utf8') > MAX_PROFILE_BYTES) {
    return res.status(400).json({ error: 'Config too large.' });
  }
  await saveProfile(identifier, config);
  res.json({ ok: true });
});

router.post('/load', profileLoadLimiter, async (req, res) => {
  if (!profilesAvailable()) return res.status(503).json({ error: 'Profile storage unavailable - MONGODB_URI is not configured.' });
  const identifier = getIdentifier(req.body);
  if (!identifier) return res.status(400).json({ error: 'identifier must be a string between 4 and 200 characters.' });
  const config = await loadProfile(identifier);
  if (!config) return res.status(404).json({ error: 'No saved profile found for this identifier.' });
  res.json({ config });
});

router.delete('/', profileLoadLimiter, async (req, res) => {
  if (!profilesAvailable()) return res.status(503).json({ error: 'Profile storage unavailable - MONGODB_URI is not configured.' });
  const identifier = getIdentifier(req.body);
  if (!identifier) return res.status(400).json({ error: 'identifier must be a string between 4 and 200 characters.' });
  await deleteProfile(identifier);
  res.json({ ok: true });
});

// Proxy Stremio login: credentials go directly to Stremio's API, we only return the authKey.
router.post('/stremio-auth', profileLoadLimiter, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email    = typeof body?.email    === 'string' ? body.email.trim()    : '';
  const password = typeof body?.password === 'string' ? body.password        : '';
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });
  let stremioRes: Response;
  try {
    stremioRes = await fetch('https://api.strem.io/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return res.status(502).json({ error: 'Could not reach the Stremio API. Check your connection.' });
  }
  const json: any = await stremioRes.json().catch(() => ({}));
  if (json.error || !json.result?.authKey) {
    return res.status(401).json({ error: json.error || 'Authentication failed.' });
  }
  res.json({ authKey: json.result.authKey, email: json.result.email || email });
});

export default router;
