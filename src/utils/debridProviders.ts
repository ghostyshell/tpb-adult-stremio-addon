/**
 * debridProviders.js
 * Registry of supported debrid services and their stream resolvers.
 *
 * IP forwarding: only Real-Debrid (ip form param) and TorBox (user_ip query
 * param) officially support attributing requests to the end user's IP.
 * userIp is still threaded through all resolvers for API consistency.
 */

import type { AddonConfig } from '../types/config';

import { resolveStreams as rdResolveStreams, resolveStreamsQuick as rdResolveStreamsQuick, resolveStreamsFromTorrentFile as rdResolveFromFile, resolveStreamsFromTorrentFileQuick as rdResolveFromFileQuick, prewarmStreams as rdPrewarm } from '../services/realdebrid';
import { resolveStreams as adResolveStreams, resolveStreamsFromTorrentFile as adResolveFromFile } from '../services/alldebrid';
import { resolveStreams as tbResolveStreams, resolveStreamsFromTorrentFile as tbResolveFromFile } from '../services/torbox';
import { resolveStreams as pmResolveStreams, resolveStreamsFromTorrentFile as pmResolveFromFile } from '../services/premiumize';
import { resolveStreams as edResolveStreams, resolveStreamsFromTorrentFile as edResolveFromFile } from '../services/easydebrid';
import { resolveStreams as dlResolveStreams, resolveStreamsFromTorrentFile as dlResolveFromFile } from '../services/debridlink';
import { resolveStreams as ocResolveStreams, resolveStreamsFromTorrentFile as ocResolveFromFile } from '../services/offcloud';
import { resolveStreams as puResolveStreams, resolveStreamsFromTorrentFile as puResolveFromFile } from '../services/putio';
import { resolveStreams as dpResolveStreams, resolveStreamsFromTorrentFile as dpResolveFromFile } from '../services/deepbrid';
import { resolveStreams as lsResolveStreams, resolveStreamsFromTorrentFile as lsResolveFromFile } from '../services/linksnappy';
import { resolveStreams as mgResolveStreams, resolveStreamsFromTorrentFile as mgResolveFromFile } from '../services/megadebrid';
import { resolveStreams as drResolveStreams, resolveStreamsFromTorrentFile as drResolveFromFile } from '../services/debrider';
import { resolveStreams as srResolveStreams, resolveStreamsFromTorrentFile as srResolveFromFile } from '../services/seedr';
import { resolveStreams as pkResolveStreams, resolveStreamsFromTorrentFile as pkResolveFromFile } from '../services/pikpak';

/** Priority order when multiple keys are present in a malformed config. */
const DEBRID_PROVIDERS = [
  { field: 'rdKey', token: 'rd', label: 'Real-Debrid',  tag: 'RD', usesIp: true,
    resolve: rdResolveStreams, resolveQuick: rdResolveStreamsQuick,
    resolveFile: rdResolveFromFile, resolveFileQuick: rdResolveFromFileQuick,
    prewarm: rdPrewarm },
  { field: 'adKey', token: 'ad', label: 'AllDebrid',    tag: 'AD', usesIp: false, resolve: adResolveStreams, resolveFile: adResolveFromFile },
  { field: 'tbKey', token: 'tb', label: 'TorBox',       tag: 'TB', usesIp: true,  resolve: tbResolveStreams, resolveFile: tbResolveFromFile },
  { field: 'pmKey', token: 'pm', label: 'Premiumize',   tag: 'PM', usesIp: false, resolve: pmResolveStreams, resolveFile: pmResolveFromFile },
  { field: 'edKey', token: 'ed', label: 'EasyDebrid',   tag: 'ED', usesIp: false, resolve: edResolveStreams, resolveFile: edResolveFromFile },
  { field: 'dlKey', token: 'dl', label: 'Debrid-Link',  tag: 'DL', usesIp: false, resolve: dlResolveStreams, resolveFile: dlResolveFromFile },
  { field: 'ocKey', token: 'oc', label: 'Offcloud',     tag: 'OC', usesIp: false, resolve: ocResolveStreams, resolveFile: ocResolveFromFile },
  { field: 'puKey', token: 'pu', label: 'Put.io',       tag: 'PU', usesIp: false, resolve: puResolveStreams, resolveFile: puResolveFromFile },
  { field: 'dpKey', token: 'dp', label: 'Deepbrid',     tag: 'DP', usesIp: false, resolve: dpResolveStreams, resolveFile: dpResolveFromFile },
  { field: 'lsKey', token: 'ls', label: 'LinkSnappy',   tag: 'LS', usesIp: false, resolve: lsResolveStreams, resolveFile: lsResolveFromFile },
  { field: 'mgKey', token: 'mg', label: 'Mega-Debrid',  tag: 'MG', usesIp: false, resolve: mgResolveStreams, resolveFile: mgResolveFromFile },
  { field: 'drKey', token: 'dr', label: 'Debrider',     tag: 'DR', usesIp: false, resolve: drResolveStreams, resolveFile: drResolveFromFile },
  { field: 'srKey', token: 'sr', label: 'Seedr',        tag: 'SR', usesIp: false, resolve: srResolveStreams, resolveFile: srResolveFromFile },
  { field: 'pkKey', token: 'pk', label: 'PikPak',       tag: 'PK', usesIp: false, resolve: pkResolveStreams, resolveFile: pkResolveFromFile },
];

const DEBRID_KEY_FIELDS = DEBRID_PROVIDERS.map((p) => p.field);

function getActiveProvider(cfg: AddonConfig) {
  return DEBRID_PROVIDERS.find((p) => cfg[p.field as keyof AddonConfig]) || null;
}

function hasDebridKey(cfg: AddonConfig): boolean {
  return DEBRID_KEY_FIELDS.some((k) => cfg[k as keyof AddonConfig]);
}

export { DEBRID_PROVIDERS, DEBRID_KEY_FIELDS, getActiveProvider, hasDebridKey, };
