/**
 * profile.ts
 * Express routes for multi-slot config profiles and Stremio authentication.
 *
 *   POST   /api/profile/stremio-auth      { email, password }                       → { authKey, email }
 *   POST   /api/profile/slots/list        { identifier: email, authKey }             → { slots: string[] }
 *   POST   /api/profile/slots/save        { identifier: email, authKey, slotName, config } → { ok: true } | 409
 *   POST   /api/profile/slots/load        { identifier: email, authKey, slotName }   → { config }
 *   DELETE /api/profile/slots             { identifier: email, authKey, slotName }   → { ok: true }
 *   DELETE /api/profile                   { identifier: email, authKey }             → { ok: true }
 */

import { Router } from 'express';
import { LRUCache } from 'lru-cache';
import {
  profileStorageReady, listProfileSlots, saveProfileSlot,
  loadProfileSlot, deleteProfileSlot, deleteProfile,
  migrateLegacyProfile, migrateEmailCasing, normalizeProfileIdentifier,
} from '../utils/profileStore';
import { profileSaveLimiter, profileLoadLimiter } from '../utils/rateLimit';

const router = Router();

const MAX_PROFILE_BYTES = 64 * 1024;

function str(body: unknown, key: string): string {
  const v = (body as Record<string, unknown>)?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function unavailable(res: any) {
  return res.status(503).json({ error: 'Profile storage unavailable - MONGODB_URI is not configured.' });
}

// ── authKey verification (bounded LRU, 10 min TTL) ───────────────────────────
//
// ponytail: was an unbounded Map with a 1h TTL - a memory leak under distinct-
// user traffic and a stale-authKey window far longer than Stremio's own session
// rotation. Capped at 10k entries / 10 min TTL via lru-cache (already a dep).

const authKeyCache = new LRUCache<string, { email: string; rawEmail: string }>({
  max: 10_000,
  ttl: 10 * 60 * 1000,
});

function stremioError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Authentication failed.';
}

// Exported for direct unit testing of the fail-closed contract.
export async function verifyAuthKey(authKey: string, expectedEmail: string): Promise<boolean> {
  const expected = normalizeProfileIdentifier(expectedEmail);
  const cached = authKeyCache.get(authKey);
  if (cached) {
    return cached.email === expected;
  }
  try {
    const res = await fetch('https://api.strem.io/api/getUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (json.error) return false;
    // Fail closed: only trust an email the Stremio authority actually returned.
    // The previous "valid result but no email" branch cached the client-supplied
    // identifier, which let anyone with any valid authKey claim to be any user
    // and read/write that user's encrypted profile slots (the encryption key is
    // derived from the identifier, so trusting it = full bypass).
    const rawEmail = String(json.result?.email || '').trim();
    if (!rawEmail) return false;
    const email = normalizeProfileIdentifier(rawEmail);
    authKeyCache.set(authKey, { email, rawEmail });
    return email === expected;
  } catch {
    return false;
  }
}

type AuthResult = { ok: true; id: string; authKey: string } | { ok: false; status: number; error: string };

async function getVerifiedIdentifier(body: unknown): Promise<AuthResult> {
  const id = normalizeProfileIdentifier(str(body, 'identifier'));
  if (id.length < 4 || id.length > 200)
    return { ok: false, status: 400, error: 'identifier must be 4-200 characters.' };
  const authKey = str(body, 'authKey');
  if (!authKey)
    return { ok: false, status: 401, error: 'authKey is required.' };
  if (!await verifyAuthKey(authKey, id))
    return { ok: false, status: 401, error: 'Invalid or expired session. Please sign in again.' };
  return { ok: true, id, authKey };
}

async function ensureMigrated(auth: { id: string; authKey: string }): Promise<void> {
  const cached = authKeyCache.get(auth.authKey);
  if (cached?.rawEmail) await migrateEmailCasing(auth.id, cached.rawEmail);
  if (auth.id !== auth.authKey) await migrateLegacyProfile(auth.id, auth.authKey);
}

// ── Stremio auth proxy ────────────────────────────────────────────────────────

router.post('/stremio-auth', profileLoadLimiter, async (req, res) => {
  const email    = str(req.body, 'email');
  const password = str(req.body, 'password');
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
    return res.status(401).json({ error: stremioError(json.error) });
  }
  const resolvedEmail = normalizeProfileIdentifier(json.result.email || email);
  const rawEmail = String(json.result.email || email).trim();
  authKeyCache.set(json.result.authKey, { email: resolvedEmail, rawEmail });
  await migrateEmailCasing(resolvedEmail, rawEmail);
  await migrateLegacyProfile(resolvedEmail, json.result.authKey);
  res.json({ authKey: json.result.authKey, email: resolvedEmail });
});

// ── Slot routes ───────────────────────────────────────────────────────────────

router.post('/slots/list', profileLoadLimiter, async (req, res) => {
  if (!await profileStorageReady()) return unavailable(res);
  const auth = await getVerifiedIdentifier(req.body);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  await ensureMigrated(auth);
  res.json({ slots: await listProfileSlots(auth.id) });
});

router.post('/slots/save', profileSaveLimiter, async (req, res) => {
  if (!await profileStorageReady()) return unavailable(res);
  const auth = await getVerifiedIdentifier(req.body);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  await ensureMigrated(auth);
  const slotName = str(req.body, 'slotName');
  if (!slotName || slotName.length > 60) return res.status(400).json({ error: 'slotName must be 1-60 characters.' });
  const config = (req.body as Record<string, unknown>).config;
  if (!isPlainObject(config)) return res.status(400).json({ error: 'config must be a plain object.' });
  if (Buffer.byteLength(JSON.stringify(config), 'utf8') > MAX_PROFILE_BYTES) {
    return res.status(400).json({ error: 'Config too large.' });
  }
  const overwrite = (req.body as Record<string, unknown>).overwrite === true;
  const result = await saveProfileSlot(auth.id, slotName, config, overwrite);
  if (result === 'duplicate') {
    return res.status(409).json({ error: `A config named "${slotName}" already exists.` });
  }
  res.json({ ok: true });
});

router.post('/slots/load', profileLoadLimiter, async (req, res) => {
  if (!await profileStorageReady()) return unavailable(res);
  const auth = await getVerifiedIdentifier(req.body);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  await ensureMigrated(auth);
  const slotName = str(req.body, 'slotName');
  if (!slotName) return res.status(400).json({ error: 'slotName is required.' });
  const config = await loadProfileSlot(auth.id, slotName);
  if (!config) return res.status(404).json({ error: `No saved config named "${slotName}".` });
  res.json({ config });
});

router.delete('/slots', profileLoadLimiter, async (req, res) => {
  if (!await profileStorageReady()) return unavailable(res);
  const auth = await getVerifiedIdentifier(req.body);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  await ensureMigrated(auth);
  const slotName = str(req.body, 'slotName');
  if (!slotName) return res.status(400).json({ error: 'slotName is required.' });
  await deleteProfileSlot(auth.id, slotName);
  res.json({ ok: true });
});

router.delete('/', profileLoadLimiter, async (req, res) => {
  if (!await profileStorageReady()) return unavailable(res);
  const auth = await getVerifiedIdentifier(req.body);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  await ensureMigrated(auth);
  await deleteProfile(auth.id);
  res.json({ ok: true });
});

export default router;
