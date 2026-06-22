import { getCatalogBases } from '../utils/adultSections';
import { PORNRIPS_STUDIOS } from '../utils/pornripsCatalogs';

export const ALL_CATALOG_BASES = getCatalogBases();
export const DEFAULT_CATALOGS = new Set(['xxx']);

export const MAX_BASES_PER_INSTANCE = Math.max(
  parseInt(process.env.MAX_BASES_PER_INSTANCE ?? '', 10) || 30,
  1,
);

export const DEBRID_TOKEN_UI = [
  { field: 'rdKey', inputId: 'realDebridToken', label: 'Real-Debrid API key', href: 'https://real-debrid.com/apitoken', hrefText: 'real-debrid.com/apitoken' },
  { field: 'adKey', inputId: 'allDebridToken', label: 'AllDebrid API key', href: 'https://alldebrid.com/apikeys', hrefText: 'alldebrid.com/apikeys' },
  { field: 'tbKey', inputId: 'torBoxToken', label: 'TorBox API key', href: 'https://torbox.app/settings', hrefText: 'torbox.app → Settings → API Keys' },
  { field: 'pmKey', inputId: 'premiumizeToken', label: 'Premiumize API key', href: 'https://www.premiumize.me/account', hrefText: 'premiumize.me/account → API' },
  { field: 'edKey', inputId: 'easyDebridToken', label: 'EasyDebrid API key', href: 'https://easydebrid.com/settings', hrefText: 'easydebrid.com/settings' },
  { field: 'dlKey', inputId: 'debridLinkToken', label: 'Debrid-Link API key', href: 'https://debrid-link.com/webapp/apikey', hrefText: 'debrid-link.com/webapp/apikey' },
  { field: 'ocKey', inputId: 'offcloudToken', label: 'Offcloud API key', href: 'https://offcloud.com/#/account', hrefText: 'offcloud.com → Account' },
  { field: 'puKey', inputId: 'putioToken', label: 'Put.io OAuth token', href: 'https://put.io/oauth/apps', hrefText: 'put.io/oauth/apps' },
  { field: 'dpKey', inputId: 'deepbridToken', label: 'Deepbrid API key', href: 'https://www.deepbrid.com/devices', hrefText: 'deepbrid.com → Devices & API' },
  { field: 'lsKey', inputId: 'linkSnappyToken', label: 'LinkSnappy login', href: 'https://linksnappy.com/myaccount', hrefText: 'linksnappy.com/myaccount (username:password)' },
  { field: 'mgKey', inputId: 'megaDebridToken', label: 'Mega-Debrid API token', href: 'https://www.mega-debrid.eu/index.php?page=api', hrefText: 'mega-debrid.eu API' },
  { field: 'drKey', inputId: 'debriderToken', label: 'Debrider API key', href: 'https://debrider.app/dashboard/account', hrefText: 'debrider.app/dashboard/account' },
  { field: 'srKey', inputId: 'seedrToken', label: 'Seedr login', href: 'https://www.seedr.cc/docs/api/rest/v1/', hrefText: 'seedr.cc API (email:password)' },
  { field: 'pkKey', inputId: 'pikpakToken', label: 'PikPak refresh token', href: 'https://mypikpak.com/', hrefText: 'mypikpak.com (refresh token)' },
] as const;

export const PRIMARY_SOURCES = [
  { value: 'piratebay', label: 'HiddenBay', desc: 'TPB-style indexes, 4K + 1080p' },
  { value: 'pornrips', label: 'PornRips.to', desc: 'Scene releases + TPDB catalog, 1080p', badge: 'Beta' as const },
  { value: 'hentai', label: 'Hentai', desc: 'HentaiMama episodes · direct play' },
  { value: 'sukebei', label: 'Sukebei', desc: 'Nyaa adult index · StashDB metadata only', badge: 'Beta' as const, requiresStashdb: true },
  { value: 'stripchat', label: 'Stripchat', desc: 'Live cams by category · username search', badge: 'Beta' as const },
] as const;

export const STUDIO_GROUP_DEFS = [
  { key: 'straight', title: 'Straight Studios' },
  { key: 'gay', title: 'Gay Studios' },
  { key: 'lesbian', title: 'Lesbian Studios' },
  { key: 'trans', title: 'Trans / TS Studios' },
  { key: 'jav_censored', title: 'JAV Censored' },
  { key: 'jav_uncensored', title: 'JAV Uncensored' },
] as const;

export const PORNRIPS_CATALOG_IDS = ['pr_recent', 'pr_studio', 'pr_tag', 'pr_search'] as const;
export const HENTAI_CATALOG_IDS = ['hentai_new', 'hentai_top', 'hentai_all', 'hentai_studios', 'hentai_years', 'hentai_search'] as const;
export const SUKEBEI_CATALOG_IDS = ['sukebei_top', 'sukebei_recent'] as const;
export const STRIPCHAT_CATALOG_IDS = ['sc_girls', 'sc_couples', 'sc_guys', 'sc_trans'] as const;

export function getNonStudioCatalogBases() {
  return ALL_CATALOG_BASES.filter((e) => !e.base.startsWith('xxx_studio_'));
}

export function getStudioCatalogEntries() {
  return ALL_CATALOG_BASES.filter((e) => e.base.startsWith('xxx_studio_'));
}

export function buildStudioGroupsData() {
  return STUDIO_GROUP_DEFS.map((g) => {
    const entries = ALL_CATALOG_BASES.filter(
      (e) => (e.orientation || 'straight') === g.key && e.base.startsWith('xxx_studio_'),
    );
    return {
      ...g,
      entries: entries.map((e) => {
        const isFhd = e.base.endsWith('_fhd');
        const baseName = e.name.replace(/ (?:4K|1080p)$/, '');
        return {
          base: e.base,
          baseName,
          isFhd,
          orientation: e.orientation || 'straight',
          defaultChecked: DEFAULT_CATALOGS.has(e.base),
        };
      }),
    };
  }).filter((g) => g.entries.length > 0);
}

export { PORNRIPS_STUDIOS };
