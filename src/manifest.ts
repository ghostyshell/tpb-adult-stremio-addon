/**
 * manifest.js
 * Dynamically build the Stremio addon manifest.
 *
 * Catalogs are all adult content from the backend's piratebay/HiddenBay
 * scraper: a "Top" (seeders) and "Recent" (newest) variant for XXX, Trans,
 * and each studio. Per-studio catalogs from backend KV "addon:xxx_studios"
 * are merged with the built-in presets.
 *
 * Stremio manifest spec: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
 */


import type { AddonConfig } from './types/config';
import { fetchStudios } from './services/backend';
import { getAdultCatalogs, compactStudioCatalogs, compactMainCatalogs } from './utils/adultSections';
import { getPornripsManifestCatalogs } from './utils/pornripsCatalogs';
import { getHentaiManifestCatalogs, getSukebeiManifestCatalogs, getStripchatManifestCatalogs } from './utils/externalCatalogs';
import { TPDB_CATALOG_ID, STASHDB_CATALOG_ID, categoryNames } from './utils/categoryCatalogs';

import { version as ADDON_VERSION } from '../package.json';
const ADDON_ID      = 'com.stremio.tpbporn';
const ADDON_NAME    = 'TPB 4K Porn';

// Debrid providers, in the same priority order parseConfig enforces.
// `field` is the config key; `token` feeds the manifest id; `label` the name.
import { DEBRID_PROVIDERS } from './utils/debridProviders';

const PROVIDERS = DEBRID_PROVIDERS.map(({ field, token, label }) => ({ field, token, label }));

/**
 * Return the single active provider for a parsed config (the one whose key is
 * set - parseConfig already enforces mutual exclusion), or null for a no-debrid
 * (P2P-only) install.
 */
function detectProvider(cfg: AddonConfig) {
  return PROVIDERS.find((p) => cfg[p.field as keyof AddonConfig]) || null;
}

// Ownership signature from stremio-addons.net (verifies the addon listing).
const STREMIO_ADDONS_CONFIG = {
  issuer: 'https://stremio-addons.net',
  signature: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..IQX5eEtvLRfKwQeJCUNDgw.Hp_PbODSKBLLPdfRAI1mKTvl4lcFBIuKz7c8ZjaEOYmGRBadY05mOomG1pzzIRvGvmYtmZ4cuAsf959RZf-RCxfJF7Ce85VUkb0lobfkXX1jNAxQH8jgIJKnK4-bQcM2.A7FLyPyrK73lAbg1YD8QGw',
};

/**
 * Build and return the complete manifest object.
 *
 * @param {object} cfg      - parsed user config
 * @param {string} baseUrl  - public base URL of this addon (e.g. https://host)
 * @returns {Promise<object>}
 */
async function buildManifest(cfg: AddonConfig, baseUrl: string) {
  // Extra studios from the backend KV (merged with the built-in presets)
  const studios = await fetchStudios(cfg.backendUrl ?? '', cfg.backendToken ?? '').catch((): string[] => []);

  // Adult catalogs: Top + Recent for XXX, Trans, and each studio.
  // Filter out any bases the user has disabled in their config.
  const disabled = new Set(cfg.disabledCatalogs || []);

  // Multi-instance split: when an enabledCatalogs allow-list is present, only
  // those bases appear (each instance carries a subset to stay under Stremio's
  // manifest descriptor size limit). Otherwise show everything minus disabled.
  const enabled = Array.isArray(cfg.enabledCatalogs) && cfg.enabledCatalogs.length > 0
    ? new Set(cfg.enabledCatalogs)
    : null;

  // When hideFromHome is on, every catalog gets a *required* `genre` extra.
  // Stremio's Home (Board) screen only renders catalogs that load with no
  // required extra, so this removes them from Home - while Discover (which
  // auto-selects the first genre option) and Search still return results.
  // The catalog route ignores the `genre` value, so browsing is unaffected.
  const homeGenre: any[] = cfg.hideFromHome
    ? [{ name: 'genre', isRequired: true, options: ['All'] }]
    : [];
  const opt = { isRequired: false };

  // Enabled content sources (default piratebay). Each source's catalogs are
  // only emitted when its source is listed, so the PornRips catalog set appears
  // exclusively for installs that turned it on.
  const sources = Array.isArray(cfg.sources) && cfg.sources.length ? cfg.sources : ['piratebay'];

  const enabledSorts = new Set(cfg.enabledSorts || ['recent', 'top']);
  const tpbCatalogs = sources.includes('piratebay')
    ? (cfg.compactStudios && enabledSorts.size > 0
        // Compact mode: one browse-only catalog per selected studio, named just
        // the studio. The studio's selected qualities and sorts are merged
        // server-side at serve time, so the manifest emits a single bare id.
        // The main XXX and Trans catalogs are emitted the same way (bare `xxx`
        // / `xxx_trans`). Gated on enabledSorts to mirror the non-compact path
        // (no sorts = no studios).
        ? compactStudioCatalogs(studios, enabled, disabled)
            .concat(compactMainCatalogs(enabled, disabled))
            .map((section) => ({
            type:  section.type,
            id:    section.id,
            name:  section.name,
            extra: [{ name: 'skip', ...opt }].concat(homeGenre),
          }))
        : getAdultCatalogs(studios)
          .filter((c) => (enabled ? enabled.has(c.base) : !disabled.has(c.base)))
          .filter((c) => enabledSorts.has(c.id.split('_').pop()))
          .map((section) => ({
            type:  section.type,
            id:    section.id,
            name:  section.name,
            // Studio catalogs are browse-only: a global Stremio search hitting all
            // 140+ studio variants simultaneously would flood the scraper backend
            // with parallel requests and trigger rate-limiting, causing empty results.
            // Main XXX catalogs are browse-only too - Search handles global search.
            extra: (section.base.includes('_studio_') || isMainXxxBrowseCatalog(section.base)
              ? [{ name: 'skip', ...opt }]
              : [{ name: 'search', ...opt }, { name: 'skip', ...opt }]
            ).concat(homeGenre),
          }))
    )
    : [];

  const pornSearchCatalogs = sources.includes('piratebay')
    ? [{
        type: 'Porn',
        id:   'search',
        name: 'Search',
        extra: [
          { name: 'search', isRequired: true },
          { name: 'skip', ...opt },
        ].concat(homeGenre),
      }]
    : [];

  // PornRips catalogs use the reference genre-dropdown model (Recent / Studio /
  // Tag / Quality / Search) instead of one catalog per studio.
  const pornripsCatalogs = sources.includes('pornrips')
    ? getPornripsManifestCatalogs(disabled, homeGenre, cfg.disabledPrStudios)
    : [];

  // Proxied external sources (Hentai) - fetched live from the reference addon.
  const hentaiCatalogs = sources.includes('hentai')
    ? getHentaiManifestCatalogs(disabled, homeGenre)
    : [];

  const tpdbActive = Boolean(process.env.TPDB_API_KEY) || Boolean((cfg.tpdbKey || '').trim());
  const stashdbActive = Boolean(process.env.STASHDB_API_KEY) || Boolean((cfg.stashdbKey || '').trim());
  const tpdbServerActive = Boolean(process.env.TPDB_API_KEY);
  const stashdbServerActive = Boolean(process.env.STASHDB_API_KEY);

  const sukebeiCatalogs = sources.includes('sukebei') && stashdbActive
    ? getSukebeiManifestCatalogs(disabled, homeGenre, cfg.enabledSorts)
    : [];

  const stripchatCatalogs = sources.includes('stripchat')
    ? getStripchatManifestCatalogs(disabled, homeGenre)
    : [];

  // Per-source category catalogs (TPDB / StashDB).  Each category is exposed as
  // a Stremio genre option.  Using isRequired:true on the genre extra keeps these
  // catalogs out of the Home (Board) screen - the same mechanism used by
  // homeGenre / hideFromHome above - so they appear only in Discover.  We do NOT
  // add the homeGenre extra on top: these are always Discover-only regardless of
  // the hideFromHome setting, and layering both genre extras confuses Stremio.
  //
  // GATING: these catalogs are served from a shared Redis cache filled by the
  // server-side category warmer (src/jobs/categoryWarmer.js), which uses the
  // SERVER env key - not a per-user key (a global background job has no per-user
  // context). So gate on the env key: a per-user-only key (no server env key)
  // could never be warmed and would surface a permanently-empty catalog.
  const categoryCatalogs: any[] = [];
  if (tpdbServerActive && Array.isArray(cfg.tpdbCategories) && cfg.tpdbCategories.length) {
    categoryCatalogs.push({
      type:  'Porn',
      id:    TPDB_CATALOG_ID,
      name:  'TPDB',
      extra: [
        { name: 'genre', isRequired: true, options: ['All', ...categoryNames(cfg.tpdbCategories)] },
        { name: 'skip' },
      ],
    });
  }
  if (stashdbServerActive && Array.isArray(cfg.stashdbCategories) && cfg.stashdbCategories.length) {
    categoryCatalogs.push({
      type:  'Porn',
      id:    STASHDB_CATALOG_ID,
      name:  'theStashDB',
      extra: [
        { name: 'genre', isRequired: true, options: ['All', ...categoryNames(cfg.stashdbCategories)] },
        { name: 'skip' },
      ],
    });
  }

  const catalogs = [...tpbCatalogs, ...pornSearchCatalogs, ...pornripsCatalogs, ...hentaiCatalogs, ...sukebeiCatalogs, ...stripchatCatalogs, ...categoryCatalogs];

  // Multi-instance identity. Each split instance needs a UNIQUE manifest id -
  // Stremio keys installed addons by id, so a constant id would make instances
  // overwrite one another. A labelled name lets users tell them apart.
  //
  // The active debrid provider (rd/ad/tb/pm) is always reflected in the name and
  // id - null only for a no-debrid (P2P-only) install. The catalog group is only
  // applied when catalogs are split for manifest size (groupTotal > 1).
  const prov = detectProvider(cfg);
  const isCatalogSplit = cfg.groupTotal > 1 && cfg.group > 0;

  // Optional user-defined postfix. Appended to the display name, and a slugified
  // form is folded into the manifest id so a postfixed install is a distinct
  // add-on in Stremio (which keys installs by id) rather than overwriting one.
  const postfix = (cfg.namePostfix || '').trim();
  const postfixSlug = postfix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);

  const id = ADDON_ID
    + (prov ? `.${prov.token}` : '')
    + (isCatalogSplit ? `.g${cfg.group}` : '')
    + (postfixSlug ? `.${postfixSlug}` : '');
  const name = ADDON_NAME
    + (prov ? ` - ${prov.label}` : '')
    + (isCatalogSplit ? ` (${cfg.group}/${cfg.groupTotal})` : '')
    + (postfix ? ` ${postfix}` : '');

  return {
    id,
    version:     ADDON_VERSION,
    name,
    logo:        baseUrl ? `${baseUrl}/icon.svg` : undefined,
    stremioAddonsConfig: STREMIO_ADDONS_CONFIG,
    description: 'Works with Stremio; Nuvio supported (debrid only). 4K & 1080p adult torrent catalogs from ThePirateBay, PornRips, and more, plus a JAV catalog and Hentai episodes from HentaiMama. Optional TPDB/theStashDB metadata. Real-Debrid, AllDebrid, TorBox, Premiumize, EasyDebrid, Debrid-Link, Offcloud, Put.io, Deepbrid, LinkSnappy, Mega-Debrid, Debrider, Seedr, or PikPak stream resolution.',

    // Resources we handle
    resources: ['catalog', 'meta', 'stream'],

    // Content types - custom "Porn" type so Stremio's type dropdown shows
    // "Porn" rather than the built-in "Movies" label.
    types: ['Porn'],

    // Item id prefixes we resolve: jstrm: (TPB/PornRips),
    // hs: (Hentai proxy).
    idPrefixes: ['jstrm:', 'jstrg:', 'hs:', 'sc:'],

    // Catalogs
    catalogs,

    // Addon behaviour hints
    behaviorHints: {
      adult:        true,
      p2p:          true,
      configurable: true,
      ...(baseUrl ? { configureUrl: `${baseUrl}/configure` } : {}),
    },
  };
}

function isMainXxxBrowseCatalog(base: string): boolean {
  return base === 'xxx' || base === 'xxx_fhd';
}

export { buildManifest, ADDON_NAME, ADDON_VERSION, PROVIDERS, detectProvider };
