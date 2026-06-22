/**
 * config.ts - Addon configuration types.
 *
 * The config object is base64url-encoded into the Stremio install URL path.
 * parseConfig() decodes, merges with defaults + env vars, and normalises.
 */

/** Debrid provider config key names (priority order = array order). */
export type DebridKeyField =
  | 'rdKey' | 'adKey' | 'tbKey' | 'pmKey'
  | 'edKey' | 'dlKey' | 'ocKey' | 'puKey'
  | 'dpKey' | 'lsKey' | 'mgKey' | 'drKey'
  | 'srKey' | 'pkKey';

/** Content source identifiers. */
export type ContentSource = 'piratebay' | 'pornrips' | 'hentai' | 'sukebei';

/** Sort variant for TPB catalogs. */
export type SortVariant = 'recent' | 'top';

/** Fully parsed and normalised addon configuration. */
export interface AddonConfig {
  // Debrid keys (mutually exclusive - parseConfig keeps only the winner)
  rdKey: string;
  adKey: string;
  tbKey: string;
  pmKey: string;
  edKey: string;
  dlKey: string;
  ocKey: string;
  puKey: string;
  dpKey: string;
  lsKey: string;
  mgKey: string;
  drKey: string;
  srKey: string;
  pkKey: string;

  sources: ContentSource[];
  disabledCatalogs: string[];
  disabledPrStudios: string[];
  enabledCatalogs: string[] | null;
  enabledSorts: SortVariant[];

  group: number;
  groupTotal: number;
  providerTotal: number;

  backendUrl: string;
  backendToken: string;

  maxResults: number;
  minSeeders: number;
  hideP2P: boolean;
  hideFromHome: boolean;
  extraIndexers: boolean;
  enable1337x: boolean;
  compactStudios: boolean;

  mediaFlowProxyUrl: string;
  mediaFlowApiPassword: string;
  proxyDebridStreams: boolean;

  namePostfix: string;

  tpdbKey: string;
  tpdbUrl: string;
  stashdbKey: string;
  stashdbUrl: string;

  tpdbCategories: string[];
  stashdbCategories: string[];
}

/** Raw user config from the base64url segment (partial, untyped). */
export type RawUserConfig = Partial<Record<string, unknown>>;

/** Result of decodeItemId() - the jstrm: ID payload. */
export interface TorrentRecord {
  h?: string;  // infoHash
  t?: string;  // title
  u?: string;  // torrentUrl
  d?: string;  // detailUrl
  w?: string;  // website source
  q?: string;  // catalog quality scope: '4k' | 'fhd' | ''
}
