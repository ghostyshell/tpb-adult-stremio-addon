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
  SUKEBEI_CATALOG_IDS,
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
  const piratebayOn = q.src_piratebay === '1' || (!pornripsOn && !hentaiOn && !sukebeiOn);

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
      sharedCfg.tpdbCategories = enabled;
    }
  } else {
    sharedCfg.tpdbCategories = [];
  }

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
      sharedCfg.stashdbCategories = enabled;
    }
  } else {
    sharedCfg.stashdbCategories = [];
  }

  const enabledSorts = ['recent', 'top'].filter((s) => q[`ct_${s}`] === '1');
  if (enabledSorts.length !== 2) {
    sharedCfg.enabledSorts = enabledSorts;
  }

  let selected = ALL_CATALOG_BASES.filter(({ base }) => q[`cat_${base}`]);
  if (selected.length === 0) selected = ALL_CATALOG_BASES;

  const chunks: typeof ALL_CATALOG_BASES[] = [];
  if (piratebayOn) {
    for (let i = 0; i < selected.length; i += MAX_BASES_PER_INSTANCE) {
      chunks.push(selected.slice(i, i + MAX_BASES_PER_INSTANCE));
    }
  }
  if (chunks.length === 0) chunks.push([]);

  const host = req.get('host') || 'localhost';
  const baseUrl = `${req.protocol}://${host}`;
  const groupTotal = chunks.length;
  const providerTotal = providers.length;

  const instances: InstallInstance[] = [];
  for (const prov of providers) {
    chunks.forEach((chunk, idx) => {
      const attachPornrips = pornripsOn && idx === 0;
      const attachHentai = hentaiOn && idx === 0;
      const attachSukebei = sukebeiOn && idx === 0;
      const instSources: string[] = [];
      if (piratebayOn) instSources.push('piratebay');
      if (attachPornrips) instSources.push('pornrips');
      if (attachHentai) instSources.push('hentai');
      if (attachSukebei) instSources.push('sukebei');
      if (!instSources.length) instSources.push('piratebay');

      const disabledCatalogs = [
        ...(attachPornrips ? prDisabled : []),
        ...(attachHentai ? hentaiDisabled : []),
        ...(attachSukebei ? sukebeiDisabled : []),
      ];

      const cfg = {
        ...sharedCfg,
        sources: instSources,
        ...(prov.field ? { [prov.field]: prov.key } : {}),
        ...(piratebayOn ? { enabledCatalogs: chunk.map((c) => c.base) } : {}),
        ...(disabledCatalogs.length ? { disabledCatalogs } : {}),
        ...(attachPornrips && disabledPrStudios.length ? { disabledPrStudios } : {}),
        ...(groupTotal > 1 ? { group: idx + 1, groupTotal } : {}),
        ...(providerTotal > 1 ? { providerTotal } : {}),
      };
      const encoded = encodeConfig(cfg as unknown as AddonConfig);
      const names = chunk.map((c) => c.name)
        .concat(attachPornrips ? prNames : [])
        .concat(attachHentai ? hentaiNames : [])
        .concat(attachSukebei ? sukebeiNames : []);
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
