/**
 * manifest.ts
 * Addon identity + debrid provider list.
 *
 * The Stremio manifest itself is built by the Go backend (torrent-search-go) and
 * proxied verbatim by this edge (see utils/stremioGo.ts and createExpressApp.ts).
 * This module only exposes the addon name/version and the provider list used by
 * the configure UI and install builder.
 */

import { version as ADDON_VERSION } from '../package.json';
import { DEBRID_PROVIDERS } from './utils/debridProviders';

const ADDON_NAME = 'TPB 4K Porn';

// Debrid providers, in the same priority order parseConfig enforces.
// `field` is the config key; `token` feeds the manifest id; `label` the name.
const PROVIDERS = DEBRID_PROVIDERS.map(({ field, token, label }) => ({ field, token, label }));

export { ADDON_NAME, ADDON_VERSION, PROVIDERS };
