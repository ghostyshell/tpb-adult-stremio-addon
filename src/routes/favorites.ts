
/**
 * favorites.js
 * REST API for the Redis-backed favourites store.
 *
 * Mounted at /api/favorites (no per-user config - favourites are global to
 * the addon instance and stored in Redis with a 30-day rolling TTL).
 *
 * Endpoints:
 *   GET    /api/favorites           - list all favourited torrent records
 *   POST   /api/favorites           - add a torrent to favourites  { id, record }
 *   DELETE /api/favorites/:id       - remove a torrent from favourites
 *   GET    /api/favorites/check/:id - check whether an ID is favourited
 */

import { Router, Response } from 'express';
import type { StoredTorrent } from '../types/debrid';
import { getFavorites, addFavorite, removeFavorite, isFavorite, } from '../utils/torrentCache';

const router = Router();

const MAX_RECORD_BYTES = 16 * 1024;
const ALLOWED_IDS = /^((jstrm|pt|hs):|porndb:)/;
const ALLOWED_FIELDS = new Set(['id', 'title', 'infoHash', 'magnetLink', 'torrentUrl', 'detailUrl', 'website', 'indexer', 'size', 'seeders', 'coverImage']);

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ALLOWED_IDS.test(id);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeRecord(record: unknown): StoredTorrent | null {
  if (!isPlainObject(record)) return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const val = record[key];
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      out[key] = val;
    }
  }
  return out as StoredTorrent;
}

function genericError(res: Response) {
  return res.status(500).json({ error: 'Internal error' });
}

router.get('/', async (req, res) => {
  try {
    const favorites = await getFavorites();
    res.json({ favorites });
  } catch (err: any) {
    console.error('[favorites] list error:', err.message);
    return genericError(res);
  }
});

router.post('/', async (req, res) => {
  const { id, record } = req.body || {};
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const clean = sanitizeRecord(record);
  if (!clean) {
    return res.status(400).json({ error: 'Invalid record' });
  }
  // Size cap to prevent Redis abuse.
  if (Buffer.byteLength(JSON.stringify(clean), 'utf8') > MAX_RECORD_BYTES) {
    return res.status(400).json({ error: 'Record too large' });
  }
  try {
    await addFavorite(id, clean);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[favorites] add error:', err.message);
    return genericError(res);
  }
});

router.delete('/:id', async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    await removeFavorite(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[favorites] remove error:', err.message);
    return genericError(res);
  }
});

router.get('/check/:id', async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const fav = await isFavorite(id);
    res.json({ isFavorite: fav });
  } catch (err: any) {
    console.error('[favorites] check error:', err.message);
    return genericError(res);
  }
});

export default router;
