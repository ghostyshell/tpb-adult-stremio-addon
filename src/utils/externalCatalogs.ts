/**
 * externalCatalogs.js
 * Catalog definitions for the proxied external sources (PornTube, Hentai),
 * modelled on pornripsCatalogs.js. Their content is fetched live from the
 * reference Stremio addons (see services/porntube.js, services/hentai.js); here
 * we only declare which catalogs we expose and their genre dropdowns.
 *
 * Per project decision, EVERYTHING maps to Stremio type 'Porn' (no movie/series).
 * Catalog ids are prefixed `pt_` (PornTube) and `hentai_` so the catalog router
 * can dispatch to the right proxy. Genre option lists are snapshotted from each
 * reference addon's manifest (externalGenres.json), with the volatile counts
 * stripped - the reference APIs match on the option name.
 */


import * as G from './externalGenres.json';

/**
 * When hideFromHome is enabled, mark an existing `genre` extra required instead
 * of appending a duplicate (Stremio still loads Home rows when the first genre
 * extra is optional).
 */
function applyHomeGenre(extra: any[], homeGenre: any[]) {
  if (!homeGenre.length) return extra;
  const existing = extra.find((e: { name: string }) => e.name === 'genre');
  if (existing) {
    existing.isRequired = true;
    return extra;
  }
  return extra.concat(homeGenre);
}

// ── PornTube ───────────────────────────────────────────────────────────────
// One catalog backed by the reference `tpdb_catalog` (already TPDB-enriched).
const PORNTUBE_CATALOGS = [
  { id: 'pt_new', their: 'tpdb_catalog', name: 'PornTube · New', options: G.PORNTUBE_GENRES, search: true },
];

// ── Hentai ─────────────────────────────────────────────────────────────────
// Mirrors the reference HentaiStream catalogs. Studio/Year need a selection to
// be meaningful, so they're hidden from Home (required genre) like PornRips.
const HENTAI_CATALOGS = [
  { id: 'hentai_new',     their: 'hentai-monthly',   name: 'Hentai · New',       options: G.HENTAI_TIME },
  { id: 'hentai_top',     their: 'hentai-top-rated',  name: 'Hentai · Top Rated', options: G.HENTAI_GENRES },
  { id: 'hentai_all',     their: 'hentai-all',        name: 'Hentai · All',       options: G.HENTAI_GENRES },
  { id: 'hentai_studios', their: 'hentai-studios',    name: 'Hentai · Studios',   options: G.HENTAI_STUDIOS, hideFromHome: true },
  { id: 'hentai_years',   their: 'hentai-years',      name: 'Hentai · Year',      options: G.HENTAI_YEARS, hideFromHome: true },
  { id: 'hentai_search',  their: 'hentai-search',     name: 'Hentai · Search',    search: true, hideFromHome: true },
];

// ── Sukebei ──────────────────────────────────────────────────────────────────
// Top/recent lists scraped server-side; only StashDB-resolved rows are cached.
const SUKEBEI_CATALOGS = [
  { id: 'sukebei_top', name: 'Sukebei · Top', sort: 'top' },
  { id: 'sukebei_recent', name: 'Sukebei · Recent', sort: 'recent' },
];

/**
 * Build Stremio manifest catalog entries from a catalog def list.
 * Mirrors getPornripsManifestCatalogs: search-only entries get a `search` extra;
 * genre lists become a `genre` dropdown; hideFromHome forces a required genre so
 * Stremio's Home skips the catalog (Discover still expands it).
 */
function buildManifestCatalogs(defs: any[], disabled: Set<string> | null | undefined, homeGenre: any[] = []) {
  return defs
    .filter((c) => !(disabled && disabled.has(c.id)))
    .map((c) => {
      let extra: any[] = [];
      if (c.search) extra.push({ name: 'search', ...(c.hideFromHome ? { isRequired: true } : {}) });
      if (c.options && c.options.length) {
        extra.push({ name: 'genre', options: ['All', ...c.options], ...(c.hideFromHome ? { isRequired: true } : {}) });
      }
      extra.push({ name: 'skip', ...(homeGenre.length ? { isRequired: false } : {}) });
      if (!c.hideFromHome) extra = applyHomeGenre(extra, homeGenre);
      return { type: 'Porn', id: c.id, name: c.name, extra };
    });
}

function getPorntubeManifestCatalogs(disabled: Set<string> | null | undefined, homeGenre: any[] = []) {
  return buildManifestCatalogs(PORNTUBE_CATALOGS, disabled, homeGenre);
}

function getHentaiManifestCatalogs(disabled: Set<string> | null | undefined, homeGenre: any[] = []) {
  return buildManifestCatalogs(HENTAI_CATALOGS, disabled, homeGenre);
}

function getSukebeiManifestCatalogs(disabled: Set<string> | null | undefined, homeGenre: any[] = [], enabledSorts: string[] | null = null) {
  const sorts = enabledSorts && enabledSorts.length
    ? new Set(enabledSorts)
    : new Set(['top', 'recent']);
  const opt = { isRequired: false };
  return SUKEBEI_CATALOGS
    .filter((c) => !(disabled && (disabled.has(c.id) || disabled.has('sukebei'))))
    .filter((c) => sorts.has(c.sort))
    .map((c) => ({
      type: 'Porn',
      id: c.id,
      name: c.name,
      extra: [{ name: 'search', ...opt }, { name: 'skip', ...opt }].concat(homeGenre),
    }));
}

/** Configure-page bases (one toggle per catalog). */
function getPorntubeBases() {
  return PORNTUBE_CATALOGS.map((c) => ({ base: c.id, name: c.name.replace('PornTube · ', '') }));
}
function getHentaiBases() {
  return HENTAI_CATALOGS.map((c) => ({ base: c.id, name: c.name.replace('Hentai · ', '') }));
}

/** Map our catalog id → the reference addon's catalog id (or null). */
function porntubeTheirCatalogId(catalogId: string) {
  const c = PORNTUBE_CATALOGS.find((x) => x.id === catalogId);
  return c ? c.their : null;
}
function hentaiTheirCatalogId(catalogId: string) {
  const c = HENTAI_CATALOGS.find((x) => x.id === catalogId);
  return c ? c.their : null;
}

export { PORNTUBE_CATALOGS, HENTAI_CATALOGS, SUKEBEI_CATALOGS, getPorntubeManifestCatalogs, getHentaiManifestCatalogs, getSukebeiManifestCatalogs, getPorntubeBases, getHentaiBases, porntubeTheirCatalogId, hentaiTheirCatalogId, };
