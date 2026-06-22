/**
 * backend.js
 * Thin client for the Go torrent-search backend. Scraping, catalog/meta serving,
 * cover extraction and enrichment all live in Go now; the addon only needs:
 *   - backendHeaders(): auth headers for the Stremio proxy (src/utils/stremioGo.js)
 *   - fetchStudios():   the per-studio catalog list (KV "addon:xxx_studios") used
 *                       by the manifest builder (src/manifest.js)
 */


import axios from 'axios';
import { sectionCache } from '../utils/cache';

/**
 * Build the headers for backend API calls. Always sends X-Addon-Token (when
 * ADDON_API_TOKEN is set) so the backend's rate limiter can exempt addon
 * traffic. The Authorization: Bearer header is sent when a backendToken is given.
 */
function backendHeaders(backendToken: string) {
  const headers: Record<string, string> = {};
  if (backendToken) headers.Authorization = `Bearer ${backendToken}`;
  const addonToken = process.env.ADDON_API_TOKEN;
  if (addonToken) headers['X-Addon-Token'] = addonToken;
  return headers;
}

/**
 * Fetch the list of adult studio names stored at KV key "addon:xxx_studios".
 *
 * @param {string} backendUrl
 * @param {string} backendToken
 * @returns {Promise<string[]>}  - e.g. ["Brazzers", "Reality Kings"]
 */
async function fetchStudios(backendUrl: string, backendToken: string) {
  if (!backendUrl) return [];

  const cacheKey = `studios:${backendUrl}`;
  const cached   = await sectionCache.get(cacheKey);
  if (cached) return cached as string[];

  const studios = await fetchKV(
    backendUrl.replace(/\/$/, ''),
    backendHeaders(backendToken),
    'addon:xxx_studios',
  );

  if (studios.length > 0) {
    await sectionCache.set(cacheKey, studios);
  }
  return studios;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function fetchKV(base: string, headers: Record<string, string>, key: string) {
  try {
    const res = await axios.get(`${base}/api/cache/get/${encodeURIComponent(key)}`, {
      headers,
      timeout: 8000,
    });
    if (res.data?.success && res.data?.value) {
      const parsed = JSON.parse(res.data.value);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_: any) {
    // Key not found or backend unavailable
  }
  return [];
}

export { backendHeaders, fetchStudios, };
