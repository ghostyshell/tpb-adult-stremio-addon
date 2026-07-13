/**
 * debrid.ts - Debrid provider registry types.
 *
 * Each provider (Real-Debrid, TorBox, etc.) registers resolve functions
 * with a common signature so the stream router can call them generically.
 */

import type { AddonConfig, DebridKeyField } from './config';

/** A resolved debrid file ready to become a Stremio stream entry. */
export interface DebridFile {
  url: string;
  fileName: string;
  fileSize?: number;
}

/** Resolve a torrent by infoHash + magnet link. */
export type ResolveStreamsFn = (
  apiKey: string,
  infoHash: string,
  magnet: string,
  userIp?: string,
) => Promise<DebridFile[]>;

/** Resolve a torrent by .torrent file URL (upload). */
export type ResolveFileFn = (
  apiKey: string,
  torrentUrl: string,
  userIp?: string,
) => Promise<DebridFile[]>;

/** Background prewarm of a torrent (uncached - continues after response). */
export type PrewarmFn = (
  apiKey: string,
  infoHash: string,
  magnet: string,
  userIp?: string,
  torrentUrl?: string,
) => Promise<unknown>;

/** Registry entry for a supported debrid service. */
export interface DebridProvider {
  field: DebridKeyField;
  token: string;
  label: string;
  tag: string;
  usesIp: boolean;
  resolve: ResolveStreamsFn;
  resolveQuick?: ResolveStreamsFn;
  resolveFile: ResolveFileFn;
  resolveFileQuick?: ResolveFileFn;
  prewarm?: PrewarmFn;
}

/** Minimal provider info emitted into the manifest (no function refs). */
export interface ProviderInfo {
  field: DebridKeyField;
  token: string;
  label: string;
}

/** Stored torrent metadata from cache (torrentCache). */
export interface StoredTorrent {
  infoHash?: string;
  title?: string;
  torrentUrl?: string;
  detailUrl?: string;
  website?: string;
  magnetLink?: string;
  size?: string;
  seeders?: number;
}

/** Type guard: does a config have any debrid key set? */
export function hasDebridKey(cfg: AddonConfig): boolean {
  const keys: DebridKeyField[] = [
    'rdKey', 'tbKey', 'pmKey',
    'edKey', 'dlKey', 'ocKey', 'puKey',
    'dpKey', 'lsKey', 'mgKey', 'drKey',
    'srKey',
  ];
  return keys.some((k) => Boolean(cfg[k]));
}
