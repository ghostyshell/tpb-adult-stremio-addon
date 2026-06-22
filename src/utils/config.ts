/**
 * config.js
 * Parse and validate addon user configuration from the URL path segment.
 *
 * Stremio encodes user config as a base64url JSON blob embedded in the
 * install URL:  https://host/{base64config}/manifest.json
 *
 * Config fields:
 *   rdKey            - Real-Debrid API key   (mutually exclusive with adKey / tbKey / pmKey)
 *   adKey            - AllDebrid API key     (mutually exclusive with rdKey / tbKey / pmKey)
 *   tbKey            - TorBox API key        (mutually exclusive with rdKey / adKey / pmKey)
 *   pmKey            - Premiumize API key    (mutually exclusive with other debrid keys)
 *   edKey            - EasyDebrid API key
 *   dlKey            - Debrid-Link API key
 *   ocKey            - Offcloud API key
 *   puKey            - Put.io OAuth token
 *   dpKey            - Deepbrid API key
 *   lsKey            - LinkSnappy credentials (username:password)
 *   mgKey            - Mega-Debrid API token
 *   drKey            - Debrider API key
 *   srKey            - Seedr credentials (email:password)
 *   pkKey            - PikPak refresh token (os.…) or base64 token JSON
 *                      Only one debrid key may be active at a time.
 *                      Priority when multiple are set:
 *                        rdKey > adKey > tbKey > pmKey > edKey > dlKey > ocKey > puKey
 *                        > dpKey > lsKey > mgKey > drKey > srKey > pkKey.
 *                      All debrid keys are per-user only (URL-encoded); there are no
 *                      server-side env vars for debrid credentials.
 *   disabledCatalogs - Array of catalog base IDs to hide (default: [] = all shown).
 *                      e.g. ["xxx_trans", "xxx_studio_vixen"]
 *   disabledPrStudios  - PornRips studio names to omit from the Studio dropdown
 *                      (default: [] = all studios shown).
 *   enabledCatalogs  - Allow-list of catalog bases (used by multi-instance splits).
 *                      null/empty → all catalogs (minus disabledCatalogs).
 *   enabledSorts     - Allow-list of TPB sort variants: 'recent' and/or 'top'.
 *                      Default ['recent', 'top']; explicit [] hides TPB sort rows.
 *   backendUrl       - Torrent search backend base URL
 *                      Falls back to BACKEND_URL env var if not set by user.
 *   backendToken     - Bearer token for the backend (optional)
 *                      Falls back to ADDON_API_TOKEN env var if not set by user.
 *   maxResults       - Max catalog results per page   (default 20)
 *   minSeeders       - Min seeders filter              (default 3)
 *   hideP2P          - Suppress direct torrent (magnet) fallback streams when a
 *                      debrid key is configured (default false).
 *   hideFromHome     - Hide catalogs from the Stremio Home (Board) screen by
 *                      marking each catalog's manifest entry with a required
 *                      `genre` extra (default false). Search and Discover still
 *                      return results; only the Home-screen rows are suppressed.
 *   mediaFlowProxyUrl      - MediaFlow Proxy base URL (e.g. http://host:8888)
 *   mediaFlowApiPassword   - MediaFlow Proxy API password
 *   proxyDebridStreams     - Enable proxying debrid stream URLs through MediaFlow
 *   tpdbKey                - ThePornDB / metadataapi.net API key (optional)
 *   tpdbUrl                - ThePornDB API base URL (default https://api.theporndb.net)
 *   stashdbKey             - StashDB GraphQL API key (https://stashdb.org, optional)
 *   stashdbUrl             - StashDB base URL (default https://stashdb.org)
 */


import type { AddonConfig } from '../types/config';
import { DEBRID_KEY_FIELDS } from './debridProviders';
import { isSafeUrl } from './safeUrl';
import { defaultEnabledSlugs, allSlugs } from './categoryCatalogs';

// Server-side defaults sourced from environment variables.
// Debrid keys (rdKey, tbKey) are intentionally absent here - they are always
// supplied per-user via the configure page and encoded in the install URL.
const ENV_BACKEND_URL   = process.env.BACKEND_URL      || '';
const ENV_BACKEND_TOKEN = process.env.ADDON_API_TOKEN  || '';
const ENV_TPDB_KEY      = process.env.TPDB_API_KEY     || '';
// ThePornDB API moved to api.theporndb.net; the old metadataapi.net host now
// serves a bot challenge instead of JSON. Migrate any old env value too.
const ENV_TPDB_URL      = (process.env.TPDB_API_URL || 'https://api.theporndb.net')
  .replace(/(?:api\.)?metadataapi\.net/i, 'api.theporndb.net');
// StashDB is a GraphQL scene database at https://stashdb.org/graphql. The API
// is read-only and requires an account (free invite via Discourse/Discord).
// Auth uses a custom `ApiKey:` header (see services/stashdb.js).
const ENV_STASHDB_KEY   = process.env.STASHDB_API_KEY  || '';
const ENV_STASHDB_URL   = (process.env.STASHDB_API_URL || 'https://stashdb.org').replace(/\/$/, '');

const DEFAULT_CONFIG: any = {
  rdKey: '',
  adKey: '',
  tbKey: '',
  pmKey: '',
  edKey: '',
  dlKey: '',
  ocKey: '',
  puKey: '',
  dpKey: '',
  lsKey: '',
  mgKey: '',
  drKey: '',
  srKey: '',
  pkKey: '',
  // Enabled content sources. 'piratebay' (TPB/HiddenBay) is the default; adding
  // 'pornrips' surfaces the separate PornRips catalog set. Each source's
  // catalogs are emitted in the manifest only when its source is listed here.
  sources: ['piratebay'],
  disabledCatalogs: [],
  disabledPrStudios: [],
  // Allow-list of catalog bases. When non-empty, ONLY these bases appear in the
  // manifest (used by the multi-instance split, where each install covers a
  // subset of catalogs to keep its manifest under Stremio's descriptor size
  // limit). null/empty → all catalogs (minus disabledCatalogs).
  // Default null for single-instance installs; multi-instance split sets this
  // to a per-group subset.
  enabledCatalogs: null,
  // Allow-list of sort variants for the TPB adult catalogs. Each selected base
  // emits a Recent and a Top catalog; this list controls which of those are
  // actually installed. Default both; a missing field defaults to both, while an
  // explicit empty array ("uncheck both") is honoured.
  enabledSorts: ['recent', 'top'],
  // Multi-instance group identity. group = 1-based index, groupTotal = number of
  // catalog-split instances. When groupTotal > 1 the manifest gets a distinct id +
  // labelled name so several instances coexist in Stremio instead of overwriting
  // each other (Stremio keys addons by manifest id).
  group: 0,
  groupTotal: 0,
  // Number of debrid providers this install was split across. When > 1 the
  // manifest id/name also carry the provider (rd/ad/tb/pm) so the per-provider
  // instances coexist instead of colliding.
  providerTotal: 0,
  backendUrl: '',
  backendToken: '',
  maxResults: 20,
  minSeeders: 3,
  hideP2P: false,
  hideFromHome: false,
  extraIndexers: false,
  enable1337x: false,
  compactStudios: false,
  mediaFlowProxyUrl: '',
  mediaFlowApiPassword: '',
  proxyDebridStreams: false,
  // Optional user-defined text appended to the add-on name (and folded into the
  // manifest id) so a customised install shows a distinct title in Stremio.
  namePostfix: '',
  // Optional TPDB (ThePornDB / metadataapi.net) API key for scene/performer
  // metadata and cover-image enrichment. Empty = disabled.
  tpdbKey: '',
  tpdbUrl: '',
  // Optional StashDB (https://stashdb.org) GraphQL API key. Read-only access
  // is enough; field-level merged with TPDB at read time - see metaMerge.js.
  stashdbKey: '',
  stashdbUrl: '',
  // Slug arrays for the TPDB and StashDB category-catalog feature.
  // [] here is a sentinel; parseConfig fills in defaultEnabledSlugs() when the
  // corresponding key is present but the user has not explicitly configured this
  // field.  An explicit [] (even empty) from the user is always honoured as-is.
  tpdbCategories: [],
  stashdbCategories: [],
};

/**
 * Decode config from a base64url path segment.
 * Returns merged config with defaults.
 * Per-user values take precedence; env vars fill in whatever is missing.
 */
function parseConfig(encoded?: string): AddonConfig {
  let userCfg: any = {};
  if (encoded && encoded !== 'default') {
    try {
      // base64url → base64 → JSON
      const b64  = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(b64, 'base64').toString('utf8');
      userCfg = JSON.parse(json);
    } catch (_: any) {
      // malformed segment - treat as no user config
    }
  }

  // Merge order (lowest → highest priority):
  //   hardcoded defaults → server env vars → per-user install config
  //
  // Empty-string values in userCfg are excluded so they cannot clobber
  // a non-empty env var value (e.g. backendUrl:"" must not override BACKEND_URL).
  const filteredUserCfg = Object.fromEntries(
    Object.entries(userCfg).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );

  const cfg: any = {
    ...DEFAULT_CONFIG,
    backendUrl:   ENV_BACKEND_URL,
    backendToken: ENV_BACKEND_TOKEN,
    tpdbKey:      ENV_TPDB_KEY,
    tpdbUrl:      ENV_TPDB_URL,
    stashdbKey:   ENV_STASHDB_KEY,
    stashdbUrl:   ENV_STASHDB_URL,
    ...filteredUserCfg,
  };

  // Enforce mutual exclusion - keep the highest-priority debrid key only.
  {
    let winner: string | null = null;
    for (const k of DEBRID_KEY_FIELDS) {
      if (cfg[k]) { winner = k; break; }
    }
    for (const k of DEBRID_KEY_FIELDS) {
      if (k !== winner) cfg[k] = '';
    }
  }

  // Normalise enabled sources to a known-value array; always keep at least
  // 'piratebay' so an install never ends up with zero catalogs.
  {
    const VALID = new Set(['piratebay', 'pornrips', 'hentai', 'sukebei', 'stripchat']);
    const list = Array.isArray(cfg.sources)
      ? cfg.sources.filter((s: string) => VALID.has(s))
      : [];
    cfg.sources = list.length > 0 ? Array.from(new Set(list)) : ['piratebay'];
  }

  // Ensure disabledCatalogs is always a plain array of strings.
  if (!Array.isArray(cfg.disabledCatalogs)) cfg.disabledCatalogs = [];
  cfg.disabledCatalogs = cfg.disabledCatalogs.filter((v: unknown) => typeof v === 'string' && v.length > 0);

  // PornRips studio deny-list (controls the Studio genre dropdown).
  if (!Array.isArray(cfg.disabledPrStudios)) cfg.disabledPrStudios = [];
  cfg.disabledPrStudios = cfg.disabledPrStudios.filter((v: unknown) => typeof v === 'string' && v.length > 0);

  // enabledCatalogs: normalise to a non-empty string array, or null (= all).
  if (Array.isArray(cfg.enabledCatalogs)) {
    const list = cfg.enabledCatalogs.filter((v: unknown) => typeof v === 'string' && v.length > 0);
    cfg.enabledCatalogs = list.length > 0 ? list : null;
  } else {
    cfg.enabledCatalogs = null;
  }

  // enabledSorts: only the TPB sort variants are valid. We inspect the raw
  // userCfg so an explicit empty array ("uncheck both") is honoured, while a
  // missing field falls back to the default of both.
  const VALID_SORTS = new Set(['recent', 'top']);
  if (Array.isArray(userCfg.enabledSorts)) {
    cfg.enabledSorts = userCfg.enabledSorts
      .filter((v: unknown): v is string => typeof v === 'string' && VALID_SORTS.has(v));
  } else {
    cfg.enabledSorts = ['recent', 'top'];
  }

  // Multi-instance group identity (cosmetic + manifest-id only).
  cfg.group         = Math.max(parseInt(cfg.group)         || 0, 0);
  cfg.groupTotal    = Math.max(parseInt(cfg.groupTotal)    || 0, 0);
  cfg.providerTotal = Math.max(parseInt(cfg.providerTotal) || 0, 0);

  // Sanitise numeric fields
  cfg.maxResults = Math.min(Math.max(parseInt(cfg.maxResults) || 20, 1), 100);
  cfg.minSeeders = Math.max(parseInt(cfg.minSeeders) || 0, 0);

  // Normalise boolean fields
  cfg.hideP2P = !!cfg.hideP2P;
  cfg.hideFromHome = !!cfg.hideFromHome;
  cfg.extraIndexers = !!cfg.extraIndexers;
  cfg.enable1337x = !!cfg.enable1337x;
  cfg.compactStudios = !!cfg.compactStudios;
  cfg.proxyDebridStreams = !!cfg.proxyDebridStreams;

  // Sanitize MediaFlow fields
  cfg.mediaFlowProxyUrl = typeof cfg.mediaFlowProxyUrl === 'string' ? cfg.mediaFlowProxyUrl : '';
  cfg.mediaFlowApiPassword = typeof cfg.mediaFlowApiPassword === 'string' ? cfg.mediaFlowApiPassword : '';

  // Custom add-on name postfix - free text, trimmed and length-capped.
  cfg.namePostfix = typeof cfg.namePostfix === 'string' ? cfg.namePostfix.trim().slice(0, 30) : '';

  // TPDB settings
  cfg.tpdbKey = typeof cfg.tpdbKey === 'string' ? cfg.tpdbKey.trim() : '';
  cfg.tpdbUrl = typeof cfg.tpdbUrl === 'string' ? cfg.tpdbUrl.replace(/\/$/, '') : ENV_TPDB_URL;
  if (!cfg.tpdbUrl) cfg.tpdbUrl = ENV_TPDB_URL;
  // TPDB enrichment is active whenever a key is configured - no separate toggle.

  // StashDB settings (mirror TPDB: trim, strip trailing slash, SSRF check).
  cfg.stashdbKey = typeof cfg.stashdbKey === 'string' ? cfg.stashdbKey.trim() : '';
  cfg.stashdbUrl = typeof cfg.stashdbUrl === 'string' ? cfg.stashdbUrl.replace(/\/$/, '') : ENV_STASHDB_URL;
  if (!cfg.stashdbUrl) cfg.stashdbUrl = ENV_STASHDB_URL;

  // Category slug lists for the TPDB and StashDB category-catalog feature.
  //
  // Presence detection: filteredUserCfg strips '', null, and undefined but
  // keeps [] (an empty array is a valid, intentional "disable all" value).
  // We therefore inspect the RAW userCfg object - before filtering - to
  // distinguish "user omitted the field" (Array.isArray returns false) from
  // "user supplied an array, even an empty one" (true).
  //
  // Decision matrix:
  //   user supplied array + key present  → filter to known slugs
  //   user supplied array + key absent   → filter to known slugs (may be [])
  //   user omitted field  + key present  → fill with default ~18 slugs
  //   user omitted field  + key absent   → leave as []
  {
    const knownTpdb = new Set(allSlugs('tpdb'));
    if (Array.isArray(userCfg.tpdbCategories)) {
      // Honor the user-supplied array; filter to valid slugs, de-duplicated.
      cfg.tpdbCategories = [...new Set((Array.isArray(cfg.tpdbCategories) ? cfg.tpdbCategories : [])
        .filter((v: unknown) => typeof v === 'string' && knownTpdb.has(v)))];
    } else if (cfg.tpdbKey) {
      // Key is present but no explicit category config - use the curated defaults.
      cfg.tpdbCategories = defaultEnabledSlugs('tpdb');
    } else {
      cfg.tpdbCategories = [];
    }
  }
  {
    const knownStashdb = new Set(allSlugs('stashdb'));
    if (Array.isArray(userCfg.stashdbCategories)) {
      // Honor the user-supplied array; filter to valid slugs, de-duplicated.
      cfg.stashdbCategories = [...new Set((Array.isArray(cfg.stashdbCategories) ? cfg.stashdbCategories : [])
        .filter((v: unknown) => typeof v === 'string' && knownStashdb.has(v)))];
    } else if (cfg.stashdbKey) {
      // Key is present but no explicit category config - use the curated defaults.
      cfg.stashdbCategories = defaultEnabledSlugs('stashdb');
    } else {
      cfg.stashdbCategories = [];
    }
  }

  // Backend URL security: a server-side BACKEND_URL takes precedence unless the
  // operator explicitly allows user-supplied backends. If no env URL is set, a
  // user URL is accepted but validated to block SSRF targets (private IPs,
  // metadata endpoints, non-http(s) schemes, embedded credentials).
  if (ENV_BACKEND_URL) {
    if (!process.env.ALLOW_USER_BACKEND) {
      cfg.backendUrl = ENV_BACKEND_URL;
      cfg.backendToken = ENV_BACKEND_TOKEN;
    } else if (cfg.backendUrl && !isSafeUrl(cfg.backendUrl).ok) {
      cfg.backendUrl = ENV_BACKEND_URL;
      cfg.backendToken = ENV_BACKEND_TOKEN;
    }
  } else if (cfg.backendUrl && !isSafeUrl(cfg.backendUrl).ok) {
    cfg.backendUrl = '';
    cfg.backendToken = '';
  }

  // Validate TPDB URL too (SSRF hardening).
  if (cfg.tpdbUrl && !isSafeUrl(cfg.tpdbUrl).ok) {
    cfg.tpdbUrl = ENV_TPDB_URL;
  }
  // Same SSRF hardening for the StashDB base URL.
  if (cfg.stashdbUrl && !isSafeUrl(cfg.stashdbUrl).ok) {
    cfg.stashdbUrl = ENV_STASHDB_URL;
  }

  return cfg;
}

/**
 * Encode a config object to a base64url string for embedding in URLs.
 */
function encodeConfig(cfg: AddonConfig): string {
  const json = JSON.stringify(cfg);
  return Buffer.from(json).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Extract the config segment from an Express request path.
 * Paths look like:  /{configSegment}/manifest.json
 *                   /{configSegment}/catalog/{type}/{id}.json
 *                   /{configSegment}/stream/{type}/{id}.json
 *
 * The segment is the first non-empty path component.
 */
function configFromRequest(req: { path: string }): AddonConfig {
  const parts = req.path.replace(/^\//, '').split('/');
  return parseConfig(parts[0]);
}

export { parseConfig, encodeConfig, configFromRequest, DEFAULT_CONFIG };
