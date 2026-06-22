/**
 * adultSections.js
 * Defines the adult content catalog sections for the Stremio home page.
 *
 * Results can be sourced from multiple trackers:
 *   - 'piratebay' (thehiddenbay.com) - category 507/505 for 4K/1080p
 *   - 'torrentgalaxy' - cat 47, no Cloudflare
 *   - 'magnetdl' - /XXX/ section, clean HTML
 *   - 'limetorrents' - /adult/ category, minimal protection
 *   - 'pornrips' - pornrips.to scene release blog
 *
 * Each logical catalog is exposed as Stremio catalogs (2 quality × 2 sort):
 *   - "<name> 4K - Top"      → seeders, descending
 *   - "<name> 4K - Recent"   → newest upload first
 *   - "<name> 1080p - Top"   → seeders, descending
 *   - "<name> 1080p - Recent"→ newest upload first
 *
 * Catalog id layout (all start with "xxx_" for routing in catalog.js):
 *   4K:    xxx_top / xxx_recent                         - browse (no query)
 *          xxx_trans_top / xxx_trans_recent              - keyword search "trans"
 *          xxx_studio_<slug>_{top,recent}                - studio keyword search
 *   1080p: xxx_fhd_top / xxx_fhd_recent
 *          xxx_trans_fhd_top / xxx_trans_fhd_recent
 *          xxx_studio_<slug>_fhd_{top,recent}
 *
 * Configuration via env var ADULT_SOURCE (default: 'piratebay'):
 *   - 'piratebay' | 'hiddenbay' - ThePirateBay via HiddenBay
 *   - 'torrentgalaxy' - TorrentGalaxy
 *   - 'magnetdl' - MagnetDL
 *   - 'limetorrents' - LimeTorrents
 *   - 'pornrips' - PornRips.to
 *   - 'all' - Multi-source (queries all, deduplicates by infoHash)
 */


const ADULT_WEBSITE = process.env.ADULT_SOURCE || 'piratebay';

// Supported sources and their metadata
const SOURCES = {
  piratebay: {
    name: 'HiddenBay',
    has4K: true,
    has1080p: true,
    categories: { '4K': '507', '1080p': '505' },
  },
  torrentgalaxy: {
    name: 'TorrentGalaxy',
    has4K: false, // Only has general adult category
    has1080p: true,
    categories: { '1080p': '47' },
  },
  magnetdl: {
    name: 'MagnetDL',
    has4K: false,
    has1080p: true,
    categories: { '1080p': 'XXX' },
  },
  limetorrents: {
    name: 'LimeTorrents',
    has4K: false,
    has1080p: true,
    categories: { '1080p': 'adult' },
  },
  pornrips: {
    name: 'PornRips',
    has4K: false,
    has1080p: true,
    categories: { '1080p': 'all' },
  },
};

// HiddenBay/piratebay sort codes (verified against the live backend)
const SORT_TOP    = '7'; // seeders, descending
const SORT_RECENT = '3'; // newest upload first

/**
 * Get quality variants for a specific source.
 * Only sources with has4K=true get 4K catalogs.
 */
function getQualitiesForSource(source: string) {
  const src = SOURCES[source as keyof typeof SOURCES];
  if (!src) return QUALITIES_DEFAULT;

  const qualities: any[] = [];
  if (src.has4K) {
    qualities.push({ marker: '', label: '4K', category: (src.categories as Record<string, string>)['4K'] || '507' });
  }
  if (src.has1080p) {
    qualities.push({ marker: 'fhd', label: '1080p', category: src.categories['1080p'] || '505' });
  }
  return qualities.length > 0 ? qualities : QUALITIES_DEFAULT;
}

const QUALITIES_DEFAULT = [
  { marker: '',    label: '4K',    category: '507' },
  { marker: 'fhd', label: '1080p', category: '505' },
];

// Logical catalogs (each expanded into Quality × Sort variants below).
//   query === '' → browse (latest uploads); query !== '' → keyword search
const LOGICAL_CATALOGS = [
  { base: 'xxx',       name: 'XXX',   query: '' },
  { base: 'xxx_trans', name: 'Trans', query: 'trans', orientation: 'trans' },
];

// All studios - preset list maintained in sync with the backend's studio search terms.
// First 52 are the established 4K presets; the remainder are 1080p-prominent studios
// derived from top-seeded scrapes of HiddenBay category 505.
const STUDIO_PRESETS = [
  'Vixen', 'DorcelClub', 'Blacked', 'BrazzersExxtra', 'Tushy', 'WowGirls',
  'Milfy', 'EvilAngel', 'OnlyFans', 'TushyRaw', 'XVideosRED', 'Private',
  'Nubiles', 'SexMex', 'Wifey', 'MetArtX', 'OnlyTarts', 'PlayboyPlus',
  'PornWorld', 'InterracialPass', 'SexArt', 'PornMegaLoad', 'TabooHeat',
  'NubileFilms', 'MetArt', 'DeepLush', 'Watch4Beauty', 'ClubSweethearts',
  'AssParade', 'BlacksOnBlondes', 'JaysPOV', 'BBCSurprise', 'ILovePOV',
  'ALSScan', 'BigTitCreampie', 'TheLifeErotic', 'Lubed', 'DigitalPlayground',
  'ATKGirlfriends', 'Bang Rammed', 'MyFriendsHotMom', 'Anilos',
  'TransRoommates', 'Swallowed', 'GenderX', 'PureMature', 'SexyCuckold',
  'MariskaX', 'MeanBitches', 'HussiePass', 'PrimalFetish',
  // 1080p-prominent studios (HD category 505, top 300 by seeders)
  'FamilyTherapyXXX', 'MissaX', 'ExploitedCollegeGirls', 'PrivateSociety',
  'WoodmanCastingX', 'MomComesFirst', 'SisLovesMe', 'SisSwap', 'DaughterSwap',
  'PureTaboo', 'Deeper', 'ExxxtraSmall', 'BackroomCastingCouch', 'LegalPorno',
  'BlackedRaw', 'PervMom', 'TouchMyWife', 'Milfty', 'FreeUseFantasy',
  'FamilyStrokes', 'PropertySex', 'SketchySex', 'TimTales', 'ChaosMen',
  // Gay-male studios (HD category 505). Result counts verified against
  // thehiddenbay.com; only studios with a meaningful catalog were kept
  // (Helix ~47, Men.com/Sean Cody/Falcon ~11 each on page 1). FraternityX,
  // Raw Fuck Club and Gangbangguys were dropped for too few results.
  'Men.com', 'Sean Cody', 'Helix Studios', 'Falcon Studios',
  // Dedicated lesbian (all-girl) studios - all verified with strong catalogs
  // on thehiddenbay.com. Girlsway/MommysGirl/GirlfriendsFilms/AllGirlMassage
  // also have 4K (507); WebYoung/Lesbea/Sweetheart Video are 1080p-only.
  'Girlsway', 'MommysGirl', 'GirlfriendsFilms', 'AllGirlMassage',
  'WebYoung', 'Lesbea', 'Sweetheart Video',
  // JAV - Japanese Adult Video (HD category 505, all 1080p-only). Studio
  // names verified to return relevant JAV on thehiddenbay.com; generic-word
  // false positives (STARS, E-BODY, S-Cute, FC2-PPV) were dropped.
  // Censored (mosaic) labels:
  'Moodyz', 'S1 No.1 Style', 'Idea Pocket', 'Prestige', 'Attackers',
  'Wanz Factory', 'FALENO', 'SOD Create', 'Madonna',
  // Uncensored sites:
  'Caribbeancom', '1Pondo', 'Heyzo', 'Tokyo Hot', '10musume',
  'Pacopacomama', 'Muramura', 'FC2',
  // Trans / TS studios - verified relevant on thehiddenbay.com. Transfixed,
  // Trans500, GroobyGirls, TGirls and Ladyboy also have 4K (507); the rest are
  // 1080p-only. (Pure-TS dropped - matched "Pure Taboo".)
  'TransAngels', 'TransSensual', 'Transfixed', 'Trans500', 'GroobyGirls',
  'TGirls', 'Ladyboy', 'TSPlayground', 'TransErotica', 'TSRaw', 'TS Factor',
];

// Studios verified to have zero results in 4K (category 507) - only get 1080p catalogs.
// Tested against thehiddenbay.com/search/{studio}/1/7/507 returning 0 results.
const STUDIO_1080P_ONLY = new Set([
  'FamilyTherapyXXX', 'PrivateSociety', 'MomComesFirst', 'PropertySex',
  'SketchySex', 'TimTales', 'ChaosMen',
  // Gay studios - none have 4K results on HiddenBay
  'Men.com', 'Sean Cody', 'Helix Studios', 'Falcon Studios',
  // Lesbian studios with no 4K results on HiddenBay
  'WebYoung', 'Lesbea', 'Sweetheart Video',
  // JAV - censored + uncensored, all HD (505) only
  'Moodyz', 'S1 No.1 Style', 'Idea Pocket', 'Prestige', 'Attackers',
  'Wanz Factory', 'FALENO', 'SOD Create', 'Madonna',
  'Caribbeancom', '1Pondo', 'Heyzo', 'Tokyo Hot', '10musume',
  'Pacopacomama', 'Muramura', 'FC2',
  // Trans studios with no/too-few 4K results on HiddenBay
  'TransAngels', 'TransSensual', 'TSPlayground', 'TransErotica', 'TSRaw', 'TS Factor',
]);

// Studio orientation groups - surfaced as separate sections (Gay / Lesbian)
// on the configure page. Anything not listed here is treated as "straight".
// Trans content has its own top-level catalog and is not classified here.
const GAY_STUDIOS = new Set([
  'SketchySex', 'TimTales', 'ChaosMen',
  'Men.com', 'Sean Cody', 'Helix Studios', 'Falcon Studios',
]);

const LESBIAN_STUDIOS = new Set([
  // Reclassified from the straight presets (predominantly girl/girl catalogs)
  'ALSScan', 'WowGirls', 'TheLifeErotic',
  // Dedicated all-girl studios added for the Lesbian group
  'Girlsway', 'MommysGirl', 'GirlfriendsFilms', 'AllGirlMassage',
  'WebYoung', 'Lesbea', 'Sweetheart Video',
]);

// JAV studios split by mosaic status: censored (Japanese-market mosaic) vs
// uncensored (member-site rips). Surfaced as two separate configure sections.
const JAV_CENSORED_STUDIOS = new Set([
  'Moodyz', 'S1 No.1 Style', 'Idea Pocket', 'Prestige', 'Attackers',
  'Wanz Factory', 'FALENO', 'SOD Create', 'Madonna',
]);

const JAV_UNCENSORED_STUDIOS = new Set([
  'Caribbeancom', '1Pondo', 'Heyzo', 'Tokyo Hot', '10musume',
  'Pacopacomama', 'Muramura', 'FC2',
]);

// Trans / TS studios - grouped with the main Trans catalog in its own section.
const TRANS_STUDIOS = new Set([
  // Reclassified from the straight presets
  'TransRoommates', 'GenderX',
  // Dedicated trans studios added for the Trans group
  'TransAngels', 'TransSensual', 'Transfixed', 'Trans500', 'GroobyGirls',
  'TGirls', 'Ladyboy', 'TSPlayground', 'TransErotica', 'TSRaw', 'TS Factor',
]);

/** Classify a studio name into a configure-page orientation group. */
function studioOrientation(studio: string) {
  if (GAY_STUDIOS.has(studio))            return 'gay';
  if (LESBIAN_STUDIOS.has(studio))        return 'lesbian';
  if (TRANS_STUDIOS.has(studio))          return 'trans';
  if (JAV_CENSORED_STUDIOS.has(studio))   return 'jav_censored';
  if (JAV_UNCENSORED_STUDIOS.has(studio)) return 'jav_uncensored';
  return 'straight';
}

const SORT_VARIANTS = [
  { suffix: 'top',    label: 'Top',    sort: SORT_TOP },
  { suffix: 'recent', label: 'Recent', sort: SORT_RECENT },
];

/**
 * Build the URL-safe id slug for a studio name.
 */
function studioSafeId(studio: string) {
  return studio
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

/**
 * Return all logical catalogs (base + studios), each as
 * { base, name, query, qualities? }.
 * qualities is omitted for the main/trans catalogs (→ all qualities).
 * Studio entries whose quality is restricted carry a `qualities` array.
 *
 * @param {string[]} studios - extra studio names from backend KV (optional)
 */
function logicalCatalogs(studios: string[] = []) {
  const list: any[] = [...LOGICAL_CATALOGS]; // xxx and xxx_trans - always both qualities
  const seen = new Set();
  for (const studio of [...STUDIO_PRESETS, ...studios]) {
    if (!studio) continue;
    const slug = studioSafeId(studio);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const entry: any = { base: `xxx_studio_${slug}`, name: studio, query: studio, orientation: studioOrientation(studio) };
    if (STUDIO_1080P_ONLY.has(studio)) {
      entry.qualities = QUALITIES_DEFAULT.filter((q) => q.marker === 'fhd');
    }
    list.push(entry);
  }
  return list;
}

/**
 * Returns the full list of adult catalog definitions (Quality × Sort per logical).
 * Each entry includes `base` so callers can filter by logical group.
 *
 * @param {string[]} studios - extra studio names from backend KV (optional)
 * @returns {Array<{id, name, type, base}>}
 */
function getAdultCatalogs(studios: string[] = []) {
  const catalogs: any[] = [];
  for (const c of logicalCatalogs(studios)) {
    for (const q of (c.qualities || QUALITIES_DEFAULT)) {
      const qBase = q.marker ? `${c.base}_${q.marker}` : c.base;
      for (const v of SORT_VARIANTS) {
        catalogs.push({
          id:   `${qBase}_${v.suffix}`,
          name: `${c.name} ${q.label} - ${v.label}`,
          type: 'Porn',
          base: qBase,
        });
      }
    }
  }
  return catalogs;
}

/**
 * Returns all catalog bases (one per logical × quality), with display names.
 * Used by the configure page for the checkbox list and the install handler.
 *
 * @param {string[]} studios - extra studio names from backend KV (optional)
 * @returns {Array<{base, name}>}
 */
function getCatalogBases(studios = []) {
  const bases: any[] = [];
  for (const c of logicalCatalogs(studios)) {
    for (const q of (c.qualities || QUALITIES_DEFAULT)) {
      const qBase = q.marker ? `${c.base}_${q.marker}` : c.base;
      bases.push({ base: qBase, name: `${c.name} ${q.label}`, orientation: c.orientation || 'straight' });
    }
  }
  return bases;
}

/**
 * Return the scraping params for a given catalog ID.
 *
 * @param {string} catalogId
 * @param {string} [source] - Optional source override (default: ADULT_WEBSITE)
 * @returns {{ website, category, query, sort, mode } | null}
 *   mode: 'browse' (no query) | 'search'
 */
function getHbParams(catalogId: string, source?: string) {
  const src = source || ADULT_WEBSITE;

  // Strip the sort variant suffix
  let sort = SORT_RECENT;
  let baseId = catalogId;
  for (const v of SORT_VARIANTS) {
    if (baseId.endsWith(`_${v.suffix}`)) {
      sort   = v.sort;
      baseId = baseId.slice(0, -(v.suffix.length + 1));
      break;
    }
  }

  // Detect quality marker: trailing _fhd → 1080p, else 4K
  let quality = '4K';
  let category = '507';
  if (baseId.endsWith('_fhd')) {
    quality  = '1080p';
    category = '505';
    baseId   = baseId.slice(0, -4); // strip _fhd
  }

  // Get source-specific category
  const srcConfig = SOURCES[src as keyof typeof SOURCES];
  if (srcConfig && srcConfig.categories) {
    category = (srcConfig.categories as Record<string, string>)[quality] || category;
  }

  // Resolve the logical base → query
  let query;
  if (baseId === 'xxx') {
    query = '';
  } else if (baseId === 'xxx_trans') {
    query = 'trans';
  } else if (baseId.startsWith('xxx_studio_')) {
    const slug   = baseId.slice('xxx_studio_'.length);
    const preset = STUDIO_PRESETS.find((s) => studioSafeId(s) === slug);
    query = preset || slug.replace(/_/g, ' ').trim();
  } else {
    return null;
  }

  return {
    website:  src,
    category,
    query,
    sort,
    mode: query ? 'search' : 'browse',
  };
}

/**
 * Get all configured sources for multi-source mode.
 */
function getConfiguredSources() {
  if (ADULT_WEBSITE === 'all') {
    return Object.keys(SOURCES);
  }
  return [ADULT_WEBSITE];
}

/**
 * Compact mode: one browse-only catalog per selected studio, named just the
 * studio (id is the bare `xxx_studio_{slug}`). A studio is selected when any of
 * its quality bases is enabled (or, with no allow-list, not disabled). 1080p-only
 * studios only have the `_fhd` base. Mirrors the Go CompactStudioCatalogs helper;
 * the merge across selected qualities/sorts happens server-side at serve time.
 *
 * @param {string[]} studios - extra studio names from backend KV (optional)
 * @param {Set<string>|null} enabled - enabledCatalogs allow-list (base ids) or null
 * @param {Set<string>} disabled - disabledCatalogs set
 * @returns {Array<{id, name, type, base}>}
 */
function compactStudioCatalogs(studios: string[] = [], enabled: Set<string> | null, disabled: Set<string>) {
  const out: any[] = [];
  for (const c of logicalCatalogs(studios)) {
    if (!c.base.startsWith('xxx_studio_')) continue;
    const base4k = c.base;
    const baseFhd = c.base + '_fhd';
    const only1080 = STUDIO_1080P_ONLY.has(c.name);
    let selected = false;
    if (enabled) {
      if (enabled.has(baseFhd)) selected = true;
      if (!selected && !only1080 && enabled.has(base4k)) selected = true;
    } else if (only1080) {
      if (!disabled.has(baseFhd)) selected = true;
    } else {
      if (!disabled.has(base4k)) selected = true;
      if (!selected && !disabled.has(baseFhd)) selected = true;
    }
    if (!selected) continue;
    out.push({ id: c.base, name: c.name, type: 'Porn', base: c.base });
  }
  return out;
}

/**
 * Compact mode: the main browse catalogs (XXX and Trans) each as one
 * browse-only catalog (bare `xxx` / `xxx_trans`), merging their 4K and 1080p
 * variants at serve time. Emitted when either quality base is enabled (or,
 * with no allow-list, not disabled). Mirrors the Go compact main-catalog path.
 */
function compactMainCatalogs(enabled: Set<string> | null, disabled: Set<string>) {
  const mains = [
    { id: 'xxx', name: 'XXX', base4k: 'xxx', baseFhd: 'xxx_fhd' },
    { id: 'xxx_trans', name: 'Trans', base4k: 'xxx_trans', baseFhd: 'xxx_trans_fhd' },
  ];
  const out: any[] = [];
  for (const m of mains) {
    let selected = false;
    if (enabled) {
      if (enabled.has(m.base4k) || enabled.has(m.baseFhd)) selected = true;
    } else {
      if (!disabled.has(m.base4k) || !disabled.has(m.baseFhd)) selected = true;
    }
    if (selected) out.push({ id: m.id, name: m.name, type: 'Porn', base: m.id });
  }
  return out;
}

export { getAdultCatalogs, getHbParams, getCatalogBases, getConfiguredSources, compactStudioCatalogs, compactMainCatalogs, STUDIO_PRESETS, LOGICAL_CATALOGS, QUALITIES_DEFAULT as QUALITIES, GAY_STUDIOS, LESBIAN_STUDIOS, TRANS_STUDIOS, JAV_CENSORED_STUDIOS, JAV_UNCENSORED_STUDIOS, studioOrientation, studioSafeId, SOURCES, ADULT_WEBSITE, };
