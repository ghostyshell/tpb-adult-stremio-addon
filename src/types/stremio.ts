/**
 * stremio.ts - Stremio addon protocol types.
 *
 * Reference: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
 */

// ── Manifest ──────────────────────────────────────────────────────────────────

export interface CatalogExtra {
  name: string;
  isRequired?: boolean;
  options?: string[];
  [key: string]: unknown;
}

export interface ManifestCatalog {
  type: string;
  id: string;
  name: string;
  extra: CatalogExtra[];
}

export interface BehaviorHints {
  adult?: boolean;
  p2p?: boolean;
  configurable?: boolean;
  configureUrl?: string;
  [key: string]: unknown;
}

export interface Manifest {
  id: string;
  version: string;
  name: string;
  logo?: string;
  description: string;
  resources: string[];
  types: string[];
  idPrefixes: string[];
  catalogs: ManifestCatalog[];
  behaviorHints: BehaviorHints;
  stremioAddonsConfig?: unknown;
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface MetaItemPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  posterShape?: 'poster' | 'square' | 'landscape';
  [key: string]: unknown;
}

export interface CatalogResponse {
  metas: MetaItemPreview[];
  [key: string]: unknown;
}

// ── Stream ────────────────────────────────────────────────────────────────────

export interface StreamBehaviorHints {
  bingeGroup?: string;
  notWebReady?: boolean;
  filename?: string;
  [key: string]: unknown;
}

export interface StremioStream {
  name?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  behaviorHints?: StreamBehaviorHints;
}

export interface StreamResponse {
  streams: StremioStream[];
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export interface Video {
  id: string;
  title?: string;
  season?: number;
  episode?: number;
  [key: string]: unknown;
}

export interface MetaDetail {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  description?: string;
  videos?: Video[];
  [key: string]: unknown;
}

export interface MetaResponse {
  meta?: MetaDetail;
}
