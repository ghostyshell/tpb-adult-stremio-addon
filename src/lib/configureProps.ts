import { ADDON_NAME, ADDON_VERSION } from '../manifest';
import { getCategories } from '../utils/categoryCatalogs';
import {
  ALL_CATALOG_BASES,
  DEBRID_TOKEN_UI,
  MAX_BASES_PER_INSTANCE,
  PORNRIPS_STUDIOS,
  PRIMARY_SOURCES,
  buildStudioGroupsData,
  getNonStudioCatalogBases,
  getStudioCatalogEntries,
  DEFAULT_CATALOGS,
} from './configureConstants';

export interface ConfigureProps {
  addonName: string;
  addonVersion: string;
  maxBases: number;
  totalBases: number;
  adultSource: string;
  envTpdbKey: boolean;
  envStashdbKey: boolean;
  debridTokenUi: typeof DEBRID_TOKEN_UI;
  debridKeys: { field: string; inputId: string }[];
  primarySources: typeof PRIMARY_SOURCES;
  hiddenCatalogBases: { base: string; orientation: string; defaultChecked: boolean }[];
  studioGroups: ReturnType<typeof buildStudioGroupsData>;
  studioTotal: number;
  pornripsStudios: readonly string[];
  tpdbCategories: ReturnType<typeof getCategories>;
  stashdbCategories: ReturnType<typeof getCategories>;
  catTotal: number;
  catDefaultCount: number;
  stashCatTotal: number;
  stashCatDefaultCount: number;
  initialSources: Record<string, boolean>;
}

export function getConfigureProps(): ConfigureProps {
  const adultSource = process.env.ADULT_SOURCE || 'piratebay';
  const envTpdbKey = Boolean(process.env.TPDB_API_KEY);
  const envStashdbKey = Boolean(process.env.STASHDB_API_KEY);
  const tpdbCategories = getCategories('tpdb');
  const stashdbCategories = getCategories('stashdb');

  const initialSources: Record<string, boolean> = {};
  for (const s of PRIMARY_SOURCES) {
    initialSources[s.value] = adultSource === s.value || adultSource === 'all';
  }

  return {
    addonName: ADDON_NAME,
    addonVersion: ADDON_VERSION,
    maxBases: MAX_BASES_PER_INSTANCE,
    totalBases: ALL_CATALOG_BASES.length,
    adultSource,
    envTpdbKey,
    envStashdbKey,
    debridTokenUi: DEBRID_TOKEN_UI,
    debridKeys: DEBRID_TOKEN_UI.map((t) => ({ field: t.field, inputId: t.inputId })),
    primarySources: PRIMARY_SOURCES,
    hiddenCatalogBases: getNonStudioCatalogBases().map((e) => ({
      base: e.base,
      orientation: e.orientation || 'straight',
      defaultChecked: DEFAULT_CATALOGS.has(e.base),
    })),
    studioGroups: buildStudioGroupsData(),
    studioTotal: getStudioCatalogEntries().length,
    pornripsStudios: PORNRIPS_STUDIOS,
    tpdbCategories,
    stashdbCategories,
    catTotal: tpdbCategories.length,
    catDefaultCount: tpdbCategories.filter((c) => c.default).length,
    stashCatTotal: stashdbCategories.length,
    stashCatDefaultCount: stashdbCategories.filter((c) => c.default).length,
    initialSources,
  };
}
