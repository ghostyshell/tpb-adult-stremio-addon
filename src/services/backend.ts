/**
 * backend.ts
 * Thin client for the Go torrent-search backend. Scraping, catalog/meta serving,
 * the manifest, cover extraction and enrichment all live in Go now; the addon
 * only needs backendHeaders(): auth headers for the Stremio proxy
 * (src/utils/stremioGo.ts).
 */

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

export { backendHeaders };
