import type { Request } from 'express';
import type { AddonConfig } from '../types/config';
import { PROVIDERS } from '../manifest';
import { encodeConfig } from '../utils/config';
import { allSlugs, defaultEnabledSlugs } from '../utils/categoryCatalogs';
import { PORNRIPS_STUDIOS } from '../utils/pornripsCatalogs';
import {
  ALL_CATALOG_BASES,
  HENTAI_CATALOG_IDS,
  MAX_BASES_PER_INSTANCE,
  PORNRIPS_CATALOG_IDS,
  STRIPCHAT_CATALOG_IDS,
  SUKEBEI_CATALOG_IDS,
  PERVERZIJA_CATALOG_IDS,
  FREEPORNVIDEOS_CATALOG_IDS,
  YESPORN_CATALOG_IDS,
  WATCHPORN_CATALOG_IDS,
  HQPORNER_CATALOG_IDS,
} from './configureConstants';

export interface InstallInstance {
  provider: string | null;
  groupLabel: string | null;
  count: number;
  names: string[];
  installUrl: string;
  manifestUrl: string;
}

export interface InstallResult {
  instances: InstallInstance[];
  providerTotal: number;
  groupTotal: number;
  hideFromHome: boolean;
}

// Case-insensitive ASCII compare (matches the Go backend's sortCatalogsByName)
// so chunk boundaries align with the backend's per-part catalog ordering.
const byCatalogName = (a: { name?: string }, b: { name?: string }) => {
  const ai = (a.name ?? '').toLowerCase();
  const bi = (b.name ?? '').toLowerCase();
  return ai < bi ? -1 : ai > bi ? 1 : 0;
};

function formData(req: Request): Record<string, string> {
  if (req.method === 'POST') return (req.body || {}) as Record<string, string>;
  return req.query as Record<string, string>;
}

export function buildInstallInstances(req: Request): InstallResult {
  const q = formData(req);

  const sharedCfg: Record<string, unknown> = {
    maxResults: parseInt(q.maxResults) || 20,
    minSeeders: parseInt(q.minSeeders) || 3,
    ...(q.hideP2P === '1' ? { hideP2P: true } : {}),
    ...(q.hideFromHome === '1' ? { hideFromHome: true } : {}),
    ...(q.extraIndexers === '1' ? { extraIndexers: true } : {}),
    ...(q.enable1337x === '1' ? { enable1337x: true } : {}),
    ...(q.compactStudios === '1' ? { compactStudios: true } : {}),
    ...(q.proxyDebridStreams === '1' ? { proxyDebridStreams: true } : {}),
    mediaFlowProxyUrl: q.mediaFlowProxyUrl || '',
    mediaFlowApiPassword: q.mediaFlowApiPassword || '',
    ...(q.namePostfix ? { namePostfix: q.namePostfix.trim().slice(0, 30) } : {}),
    ...(q.tpdbKey ? { tpdbKey: q.tpdbKey.trim() } : {}),
    ...(q.stashdbKey ? { stashdbKey: q.stashdbKey.trim() } : {}),
  };

  const providers = PROVIDERS
    .map((p) => ({ ...p, key: (q[p.field] || '').trim() }))
    .filter((p) => p.key);
  if (providers.length === 0) providers.push({ field: '', token: '', label: '', key: '' });

  const pornripsOn = q.src_pornrips === '1';
  const hentaiOn = q.src_hentai === '1';
  const sukebeiOn = q.src_sukebei === '1';
  const stripchatOn = q.src_stripchat === '1';
  const perverzijaOn = q.src_perverzija === '1';
  const freepornvideosOn = q.src_freepornvideos === '1';
  const yespornOn = q.src_yesporn === '1';
  const watchpornOn = q.src_watchporn === '1';
  const hqpornerOn = q.src_hqporner === '1';
  const piratebayOn = q.src_piratebay === '1'
    || (!pornripsOn && !hentaiOn && !sukebeiOn && !stripchatOn && !perverzijaOn && !freepornvideosOn && !yespornOn && !watchpornOn && !hqpornerOn);

  const prDisabled = pornripsOn ? PORNRIPS_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const prNames = pornripsOn
    ? PORNRIPS_CATALOG_IDS.filter((id) => !prDisabled.includes(id)).map((id) => `PornRips · ${id.slice(3)}`)
    : [];

  const hentaiDisabled = hentaiOn ? HENTAI_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const sukebeiDisabled = sukebeiOn ? SUKEBEI_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const hentaiNames = hentaiOn
    ? HENTAI_CATALOG_IDS.filter((id) => !hentaiDisabled.includes(id)).map((id) => `Hentai · ${id.slice(7)}`)
    : [];
  const sukebeiNames = sukebeiOn
    ? SUKEBEI_CATALOG_IDS.filter((id) => !sukebeiDisabled.includes(id)).map((id) => `Sukebei · ${id.slice(8)}`)
    : [];
  const stripchatDisabled = stripchatOn ? STRIPCHAT_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const stripchatNames = stripchatOn
    ? STRIPCHAT_CATALOG_IDS.filter((id) => !stripchatDisabled.includes(id)).map((id) => {
        const name = id.charAt(3).toUpperCase() + id.slice(4);
        return `Stripchat · ${name}`;
      })
    : [];
  const perverzijaDisabled = perverzijaOn ? PERVERZIJA_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const perverzijaNames = perverzijaOn
    ? PERVERZIJA_CATALOG_IDS.filter((id) => !perverzijaDisabled.includes(id)).map((id) => `Perverzija · ${id.slice(4)}`)
    : [];
  const freepornvideosDisabled = freepornvideosOn ? FREEPORNVIDEOS_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const freepornvideosNames = freepornvideosOn
    ? FREEPORNVIDEOS_CATALOG_IDS.filter((id) => !freepornvideosDisabled.includes(id)).map((id) => `FreePornVideos · ${id.slice(4)}`)
    : [];
  const yespornDisabled = yespornOn ? YESPORN_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const yespornNames = yespornOn
    ? YESPORN_CATALOG_IDS.filter((id) => !yespornDisabled.includes(id)).map((id) => `YesPorn · ${id.slice(4)}`)
    : [];
  const watchpornDisabled = watchpornOn ? WATCHPORN_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const watchpornNames = watchpornOn
    ? WATCHPORN_CATALOG_IDS.filter((id) => !watchpornDisabled.includes(id)).map((id) => `WatchPorn · ${id.slice(4)}`)
    : [];
  const hqpornerDisabled = hqpornerOn ? HQPORNER_CATALOG_IDS.filter((id) => q[`cat_${id}`] !== '1') : [];
  const hqpornerNames = hqpornerOn
    ? HQPORNER_CATALOG_IDS.filter((id) => !hqpornerDisabled.includes(id)).map((id) => `HQporner · ${id.slice(4)}`)
    : [];

  let disabledPrStudios: string[] = [];
  if (pornripsOn && q.disabledPrStudios) {
    try {
      const parsed = JSON.parse(q.disabledPrStudios);
      if (Array.isArray(parsed)) {
        const valid = new Set(PORNRIPS_STUDIOS);
        disabledPrStudios = parsed.filter((s) => valid.has(s));
      }
    } catch {
      /* ignore malformed JSON */
    }
  }

  // TPDB/StashDB category catalogs are not chunked across parts (only piratebay
  // bases are). Attach them to part 1 only so they are not duplicated across
  // every part - the backend emits them when len(categories) > 0, so leaving
  // the field unset for parts 2..N suppresses them there.
  let tpdbCategories: string[] | undefined;
  if (q.enableTpdbCatalog === '1') {
    let enabled = defaultEnabledSlugs('tpdb');
    if (q.tpdbCategories) {
      try {
        const parsed = JSON.parse(q.tpdbCategories);
        if (Array.isArray(parsed)) {
          const validSet = new Set(allSlugs('tpdb'));
          enabled = [...new Set(parsed.filter((s) => validSet.has(s)))];
        }
      } catch {
        /* ignore */
      }
    }
    const defs = defaultEnabledSlugs('tpdb');
    const same = enabled.length === defs.length && defs.every((s) => enabled.includes(s));
    if (!same || enabled.length === 0 || !(q.tpdbKey && q.tpdbKey.trim())) {
      tpdbCategories = enabled;
    }
  } else {
    tpdbCategories = [];
  }

  let stashdbCategories: string[] | undefined;
  if (q.enableStashdbCatalog === '1') {
    let enabled = defaultEnabledSlugs('stashdb');
    if (q.stashdbCategories) {
      try {
        const parsed = JSON.parse(q.stashdbCategories);
        if (Array.isArray(parsed)) {
          const validSet = new Set(allSlugs('stashdb'));
          enabled = [...new Set(parsed.filter((s) => validSet.has(s)))];
        }
      } catch {
        /* ignore */
      }
    }
    const defs = defaultEnabledSlugs('stashdb');
    const same = enabled.length === defs.length && defs.every((s) => enabled.includes(s));
    if (!same || enabled.length === 0 || !(q.stashdbKey && q.stashdbKey.trim())) {
      stashdbCategories = enabled;
    }
  } else {
    stashdbCategories = [];
  }

  const enabledSorts = ['recent', 'top'].filter((s) => q[`ct_${s}`] === '1');
  if (enabledSorts.length !== 2) {
    sharedCfg.enabledSorts = enabledSorts;
  }

  let selected = ALL_CATALOG_BASES.filter(({ base }) => q[`cat_${base}`]);
  if (selected.length === 0) selected = ALL_CATALOG_BASES.slice();
  // Sort by display name so multi-part splits assign alphabetically-adjacent
  // studio ranges to each part; the backend's per-part sort then composes a
  // globally alphabetical studio block when parts are installed in order.
  // ASCII toLowerCase compare (not localeCompare) matches the Go backend so
  // chunk boundaries line up with the backend's per-part ordering.
  selected.sort(byCatalogName);
  // The backend sorts the main XXX/Trans browse catalogs into the first
  // (non-studio) board block, ahead of every studio. Mirror that here by
  // pinning them to the front of the split so they land in part 1 (not a later
  // part), each block still alphabetical. Studios follow, chunked as before.
  selected = [
    ...selected.filter((c) => !c.base.startsWith('xxx_studio_')),
    ...selected.filter((c) => c.base.startsWith('xxx_studio_')),
  ];

  const chunks: typeof ALL_CATALOG_BASES[] = [];
  if (piratebayOn) {
    for (let i = 0; i < selected.length; i += MAX_BASES_PER_INSTANCE) {
      chunks.push(selected.slice(i, i + MAX_BASES_PER_INSTANCE));
    }
  }
  if (chunks.length === 0) chunks.push([]);

  // Prefer pinned PUBLIC_HOST so a spoofed X-Forwarded-Host can't poison the
  // install URLs (which embed the user's debrid API key in the config segment).
  const pinnedHost = (process.env.PUBLIC_HOST || '').trim().replace(/\/$/, '');
  const host = pinnedHost
    ? pinnedHost.replace(/^https?:\/\//, '')
    : (req.get('host') || 'localhost');
  const baseUrl = pinnedHost || `${req.protocol}://${host}`;
  const groupTotal = chunks.length;
  const providerTotal = providers.length;

  const instances: InstallInstance[] = [];
  for (const prov of providers) {
    chunks.forEach((chunk, idx) => {
      const attachPornrips = pornripsOn && idx === 0;
      const attachHentai = hentaiOn && idx === 0;
      const attachSukebei = sukebeiOn && idx === 0;
      const attachStripchat = stripchatOn && idx === 0;
      const attachPerverzija = perverzijaOn && idx === 0;
      const attachFreepornvideos = freepornvideosOn && idx === 0;
      const attachYesporn = yespornOn && idx === 0;
      const attachWatchporn = watchpornOn && idx === 0;
      const attachHqporner = hqpornerOn && idx === 0;
      const instSources: string[] = [];
      if (piratebayOn) instSources.push('piratebay');
      if (attachPornrips) instSources.push('pornrips');
      if (attachHentai) instSources.push('hentai');
      if (attachSukebei) instSources.push('sukebei');
      if (attachStripchat) instSources.push('stripchat');
      if (attachPerverzija) instSources.push('perverzija');
      if (attachFreepornvideos) instSources.push('freepornvideos');
      if (attachYesporn) instSources.push('yesporn');
      if (attachWatchporn) instSources.push('watchporn');
      if (attachHqporner) instSources.push('hqporner');
      if (!instSources.length) instSources.push('piratebay');

      const disabledCatalogs = [
        ...(attachPornrips ? prDisabled : []),
        ...(attachHentai ? hentaiDisabled : []),
        ...(attachSukebei ? sukebeiDisabled : []),
        ...(attachStripchat ? stripchatDisabled : []),
        ...(attachPerverzija ? perverzijaDisabled : []),
        ...(attachFreepornvideos ? freepornvideosDisabled : []),
        ...(attachYesporn ? yespornDisabled : []),
        ...(attachWatchporn ? watchpornDisabled : []),
        ...(attachHqporner ? hqpornerDisabled : []),
      ];

      const cfg = {
        ...sharedCfg,
        sources: instSources,
        ...(prov.field ? { [prov.field]: prov.key } : {}),
        ...(piratebayOn ? { enabledCatalogs: chunk.map((c) => c.base) } : {}),
        ...(disabledCatalogs.length ? { disabledCatalogs } : {}),
        ...(attachPornrips && disabledPrStudios.length ? { disabledPrStudios } : {}),
        // TPDB/StashDB category catalogs belong on part 1 only. Part 1 carries
        // the resolved category list (or omits it so the backend fills defaults
        // from the tpdb/stashdb key - still one emission). Parts 2..N send an
        // explicit empty array: the backend emits these catalogs only when
        // len(categories) > 0, but when the field is OMITTED and a key is present
        // it fills default (non-empty) categories - so omitting on parts 2..N
        // would re-emit TPDB/StashDB on every part whenever a key is set. An
        // explicit [] suppresses them regardless of key.
        ...(idx === 0 && tpdbCategories !== undefined ? { tpdbCategories } : {}),
        ...(idx === 0 && stashdbCategories !== undefined ? { stashdbCategories } : {}),
        ...(idx > 0 ? { tpdbCategories: [], stashdbCategories: [] } : {}),
        ...(groupTotal > 1 ? { group: idx + 1, groupTotal } : {}),
        ...(providerTotal > 1 ? { providerTotal } : {}),
      };
      const encoded = encodeConfig(cfg as unknown as AddonConfig);
      const names = chunk.map((c) => c.name)
        .concat(attachPornrips ? prNames : [])
        .concat(attachHentai ? hentaiNames : [])
        .concat(attachSukebei ? sukebeiNames : [])
        .concat(attachStripchat ? stripchatNames : [])
        .concat(attachPerverzija ? perverzijaNames : [])
        .concat(attachFreepornvideos ? freepornvideosNames : [])
        .concat(attachYesporn ? yespornNames : [])
        .concat(attachWatchporn ? watchpornNames : [])
        .concat(attachHqporner ? hqpornerNames : []);
      instances.push({
        provider: prov.label || null,
        groupLabel: groupTotal > 1 ? `Part ${idx + 1} of ${groupTotal}` : null,
        count: names.length,
        names,
        installUrl: `stremio://${host}/${encoded}/manifest.json`,
        manifestUrl: `${baseUrl}/${encoded}/manifest.json`,
      });
    });
  }

  return {
    instances,
    providerTotal,
    groupTotal,
    hideFromHome: Boolean(sharedCfg.hideFromHome),
  };
}
