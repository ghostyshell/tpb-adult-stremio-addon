# Changelog

All notable changes to **tpb-stremio-addon** (Stremio edge / configure UI) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and tracks `package.json`.

---

## [Unreleased]

### Added
- **HQporner source is now selectable on the configure page** - the Go backend ships a sixth tube source (`hqporner.com`, `hqp_*` catalogs, multi-quality mp4), added on the Phase-0 shared `TubeSource` interface. Like WatchPorn it is populated by a Mac-side launchd cron, but for a different reason: hqporner.com is reachable from prod, but its stream resolve is a 2-hop `mydaddy.cc` -> `bigcdn.cc` walk that runs on the Mac at enrich time so prod never dials mydaddy.cc (prod reads Mongo + the Redis genre blob and emits the stored tokenless bigcdn mp4s directly). The configure UI labels it "Mac-cron populated". The edge exposes it identically to the other tube sources except it has **no Studio catalog** (hqporner exposes no studios), so the per-source Catalogs tab has four toggles (Recent / Tag / Performer / Search) instead of five. Wiring mirrors the watchporn entry: `src/utils/config.ts` `VALID` adds `hqporner`; `src/lib/configureConstants.ts` adds it to `PRIMARY_SOURCES` plus `HQPORNER_CATALOG_IDS = ['hqp_recent','hqp_tag','hqp_performer','hqp_search']` (no `hqp_studio`); `src/lib/installBuilder.ts` reads `src_hqporner`, adds it to the piratebay fallback disjunction, and attaches its catalogs to install part 1 (per-catalog disable + display names like `HQporner · recent`, `id.slice(4)`); `src/components/configure/configureUiData.tsx` adds the tab + nav entry; `src/components/configure/ConfigureApp.tsx` holds the `hqpornerCatalogs` state and round-trips it; `src/lib/addonStatus.ts` adds `hqporner` to `REPORT_TO_KEY`; `src/types/config.ts` `ContentSource` adds `'hqporner'`; `src/components/configure/panels/TubeCatalogPanel.tsx` doc comment updated to note the 4-catalog shape. `tsc --noEmit` clean; `next build` clean; 234 tests pass.
- **WatchPorn source is now selectable on the configure page** - the Go backend ships a fourth tube source (`watchporn.to`, `wpt_*` catalogs, multi-quality mp4), added on the Phase-0 shared `TubeSource` interface. Unlike the other tube sources it is populated by a Mac-side launchd cron (watchporn.to is TLS-blocked from prod egress), so the configure UI labels it "Mac-cron populated". The edge exposes it identically to YesPorn/Perverzija/FreePornVideos: an opt-in toggle in the Active Sources card (off by default) and a per-source Catalogs tab with five catalog toggles (Recent / Studio / Tag / Performer / Search). Wiring mirrors the yesporn entry: `src/utils/config.ts` `VALID` adds `watchporn`; `src/lib/configureConstants.ts` adds it to `PRIMARY_SOURCES` plus `WATCHPORN_CATALOG_IDS = ['wpt_recent','wpt_studio','wpt_tag','wpt_performer','wpt_search']`; `src/lib/installBuilder.ts` reads `src_watchporn`, adds it to the piratebay fallback disjunction, and attaches its catalogs to install part 1 (per-catalog disable + display names like `WatchPorn · recent`, `id.slice(4)`); `src/components/configure/configureUiData.tsx` adds the tab + nav entry; `src/components/configure/ConfigureApp.tsx` holds the `watchpornCatalogs` state and round-trips it; `src/lib/addonStatus.ts` adds `watchporn` to `REPORT_TO_KEY`; `src/types/config.ts` `ContentSource` adds `'watchporn'`. `tsc --noEmit` clean; 234 tests pass.
- **YesPorn source is now selectable on the configure page** - the Go backend ships a third direct-play tube source (`yesporn.vip`, `ypv_*` catalogs, multi-quality mp4), added on the Phase-0 shared `TubeSource` interface. The edge now exposes it identically to Perverzija/FreePornVideos: an opt-in toggle in the Active Sources card (off by default) and a per-source Catalogs tab with five catalog toggles (Recent / Studio / Tag / Performer / Search). Wiring mirrors the freepornvideos entry: `src/utils/config.ts` `VALID` adds `yesporn`; `src/lib/configureConstants.ts` adds it to `PRIMARY_SOURCES` plus `YESPORN_CATALOG_IDS = ['ypv_recent','ypv_studio','ypv_tag','ypv_performer','ypv_search']`; `src/lib/installBuilder.ts` reads `src_yesporn`, adds it to the piratebay fallback disjunction, and attaches its catalogs to install part 1 (per-catalog disable + display names like `YesPorn · recent`, `id.slice(4)`); `src/components/configure/configureUiData.tsx` adds the tab + nav entry; `src/components/configure/ConfigureApp.tsx` holds the `yespornCatalogs` state and round-trips it; `src/lib/addonStatus.ts` adds `yesporn` to `REPORT_TO_KEY`; `src/types/config.ts` `ContentSource` adds `'yesporn'`. `tsc --noEmit` clean; `next build` clean; 234 tests pass.
- **Perverzija and FreePornVideos sources are now selectable on the configure page** - the Go backend already ships these two direct-play tube sources (`pvz_*` / `fpv_*` catalogs, multi-quality HLS/mp4 streams), but the edge had no way to opt into them. They now appear as opt-in toggles in the Active Sources card (off by default; fresh installs keep HiddenBay + PornRips + Stripchat). Toggling one on reveals a per-source Catalogs tab with five catalog toggles (Recent / Studio / Tag / Performer / Search). Wiring: `src/utils/config.ts` `VALID` source whitelist adds `perverzija` / `freepornvideos` (without this `parseConfig` stripped them from every install config); `src/lib/configureConstants.ts` adds them to `PRIMARY_SOURCES` plus `PERVERZIJA_CATALOG_IDS` / `FREEPORNVIDEOS_CATALOG_IDS`; `src/lib/installBuilder.ts` reads `src_perverzija` / `src_freepornvideos`, adds them to the piratebay fallback disjunction (a tube-only install no longer forces piratebay on), and attaches their catalogs to install part 1 (with per-catalog disable + display names like `Perverzija · recent`, `id.slice(4)`); `src/components/configure/configureUiData.tsx` adds the two tabs + nav entries; `src/components/configure/panels/TubeCatalogPanel.tsx` (new) is one shared parameterized panel rendered for both sources instead of two near-duplicate panels; `src/components/configure/ConfigureApp.tsx` holds the catalog-toggle state and round-trips it through saved profiles; `src/lib/addonStatus.ts` adds the sources to `REPORT_TO_KEY` so MAINTENANCE/DOWN badges work once the backend reports them. `tsc --noEmit` clean; `next build` clean; 234 tests pass (3 new tube-source tests); encode/parse round-trip confirms a tube-only config decodes to exactly `["perverzija","freepornvideos"]`.

### Changed
- **480p quality floor removed from the stream filter** - `src/routes/stream.ts` `applyQualityFilter` no longer drops streams detected as 480p. A scene whose only available torrent is 480p (common for stashdb/porndb entries where the lone match is a 480p release) previously returned `{streams:[]}` through the edge, looking like the entry had no sources at all. 480p streams now pass through and sink to the bottom via the existing `QUALITY_RANK` sort (480p is unranked, so it sorts last), so higher-quality streams still surface first when present. The quality-scoped catalog filter (fhd/4k catalogs dropping non-matching resolutions) is unchanged; `detectQuality` still detects 480p for the sort. Matches backend behaviour, which never applied a 480p floor.

### Removed
- **Bitsearch dropped from the extra-indexers set** - `src/routes/stream.ts` `EXTRA_INDEXER_WEBSITES` no longer lists `bitsearch`, and the "Extra indexers" toggle description in `src/components/configure/panels/SetupPanel.tsx` now reads "Add Knaben to search, plus XxxClub to browse" (was "Add Knaben & Bitsearch to search, plus XxxClub to browse"). The backend `bitsearch.eu` scraper/provider are removed in the matching `torrent-search-go` change; Knaben and XxxClub behaviour is unchanged. `tsc --noEmit` clean.

### Fixed
- **Sliplane builds timed out at 1h (stuck at 1.9.85, two deploys behind)** - every cold build on the Sliplane builder hung for the full 1h timeout (the service runs `SLIPLANE_SKIP_CACHE`, so every build is cold). Builds through 1.9.85 were warm (~38s) because the builder's layer cache held a prior `node_modules`; once that cache was evicted (~Jul 12 04:58Z), every cold deploy hung. Root cause: `vitest` 4 / `vite` 7 / `@vitest/coverage-v8` (devDependencies) pull a native-binary stack whose fetch hangs on the Sliplane builder, and `next build` re-installs the entire dev tree (including those) via its "Installing devDependencies" auto-install whenever `typescript` is absent from `node_modules`. So the hang hit whichever step touched vitest: `npm ci --include=dev` installed it directly, and `npm ci --omit=dev` left `typescript` absent so `next build` auto-installed it right back. The fix has two parts that must both hold: (1) `npm ci --omit=dev --ignore-scripts` so vitest/vite/`@vitest/coverage-v8` are never installed by npm, and (2) `typescript` + `@types/*` moved from `devDependencies` to `dependencies` in `package.json` so `--omit=dev` still installs them (they are prod now), `next build` finds `typescript` present, and the auto-install never fires. vitest is now fetched by neither step. `--ignore-scripts` additionally skips the `esbuild` / `@rolldown/binding` postinstall binary fetches (their platform binaries ship as npm optionalDeps that esbuild/rolldown locate at require time, so `next build` + the `tsx src/server.ts` runtime work with scripts skipped). Verified on `node:24-alpine`: cold `docker build --no-cache` 17s, `vitest`/`vite`/`@vitest/coverage-v8` absent, `typescript` present, no "Installing devDependencies" banner, BUILD_ID present, container starts and binds :7000, 234 tests pass. Also added a `.dockerignore` (build context is just `src` + `public` + configs) and repointed the Sliplane service at the Dockerfile (`dockerfilePath: "Dockerfile"`) so it `docker build`s the image instead of using the Node buildpack. (Three earlier attempts - `--include=dev`, then `--ignore-scripts`, then pinning `node:22-alpine` - did not fix the hang; all three builds still timed out, which isolated the hang to the vitest native fetch + Next's dev-dep auto-install, not the base image or the install flags alone.)
- **StashDB (`stash:`) entries returned no streams through the edge** - `src/routes/stream.ts` `handleStream` had a `porndb:` branch but no `stash:` branch, so a Stremio install hitting the edge fell through to the empty `{streams:[]}` return for every stashdb catalog entry. The Go backend resolves both `porndb:` and `stash:` ids to infoHashes through the same `tpdbStreams` path, so the edge now routes `stash:` through the existing `porndbStreams` resolver (debrid when configured, P2P magnet otherwise) - one-line branch widen on `id.startsWith('porndb:') || id.startsWith('stash:')`. Direct-backend installs were already working; only the edge path was broken.
- **Seedr streams never resolved (no torrents added, no streams) for `email:password` or PAT configs** - `src/services/seedr.ts` used the premium-only `/rest/*` HTTP Basic-auth API, which returns `{"result":false,"error":"access_denied"}` for non-premium accounts on every call, so `addMagnet` failed before any torrent was added. A PAT (`sdp_...`) also failed because `parseCreds` required an `email:password` colon. Rewrote the client to route by credential type: a PAT (no `@` in `srKey`) now drives REST v2 at `https://www.seedr.cc/api/v0.1/p/` with `Authorization: Bearer` (`POST /tasks` -> poll `GET /tasks/{id}` -> `GET /fs/folder/{id}/contents` -> `GET /download/file/{id}/url`), the only path that can transfer torrents on free accounts; `email:password` drives the oauth_test v1 API (`POST /oauth_test/token.php` with `client_id=seedr_chrome` -> `POST /oauth_test/resource.php` with `func=`), and on non-premium accounts surfaces a clear error pointing the user at a PAT instead of failing opaquely. The torrent-URL fallback now derives the infohash from the `.torrent` (`fetchInfoHashFromTorrentUrl`) and reuses the magnet path. Configure UI label, README, and docs updated to document the PAT option. `tsc --noEmit` clean; 231 tests pass; verified live end-to-end against a free account (zero quota, cached Sintel).

## [1.9.80] - 2026-07-04

### Changed
- **Dockerfile OCI label no longer describes the addon as "adult torrent catalogs with Real-Debrid"** - the `org.opencontainers.image.description` now reflects the actual surface: 12 debrid providers, six catalog sources (HiddenBay, PornRips, Hentai, Sukebei, TPDB, StashDB), Stripchat live HLS, and the React/Next.js configure UI.
- **README env table expanded from the common 9 knobs to the full operator surface** - added `ADMIN_TOKEN`, `SESSION_SECRET`, `ALLOW_USER_BACKEND`, `TRUST_PROXY_HOPS`, the three `RATE_LIMIT_*` caps, the `MONGO_*` family pointer, and the `TTL_*` range, each cross-checked against `.env.example` and `docs/configuration.md`. The full reference still lives in `docs/configuration.md`; the README now lists the knobs operators actually reach for.
- **CLAUDE.md converted from full standalone content to a thin pointer at AGENTS.md** - AGENTS.md is now the single source of truth for agent instructions (project overview, file table, data flow, commands, conventions, the "Keeping docs & instructions in sync" section). Cursor rules (`.cursor/rules/graphify.mdc`, `no-em-dashes.mdc`) and `.opencode/opencode.json` (ponytail plugin wiring) added; the existing `.opencode/agents/sliplane-ssh.md` is kept.

### Added
- **Stripchat feature documented end-to-end (previously zero mentions in README + docs/)** - new README "Stripchat Live Cams" section and a dedicated `docs/stripchat.md` page covering the three services (`stripchatHls.ts`, `stripchatKeys.ts`, `stripchatMouflon.ts`), the two routes (`/stripchat/hls/:username/:quality`, `/stripchat/seg?url=`), the MOUFLON v2 decryption flow, the `PD_KEY_*` env wiring, and why streams play in the Stremio internal player (`notWebReady: false` + CSP dropped from `/stripchat/*` media-proxy responses).
- **Previously-undocumented endpoints added to the README "HTTP API" table** - `/stripchat/hls`, `/stripchat/seg`, `/admin/flush-cat-cache`, `/api/profile`, and `/health` are now listed alongside the Stremio protocol routes.
- **AGENTS.md** created as the single source of truth for agent instructions across Claude Code, Cursor, and OpenCode.

### Fixed
- **Em/en-dash sweep across README + docs/** - replaced every U+2014 (em dash) and U+2013 (en dash) with `-` or restructured prose across `docs/privacy.html` (15 hits incl. the `<title>`), `docs/*.md` (~270 hits across architecture, configuration, code-structure, development, providers-and-streams, go-migration, and the vendored refactor skill phases). Code identifiers, URLs, flags, and backticked content untouched. `grep -rn '[—–]' README.md docs/` now returns zero hits.

## [1.9.79] - 2026-07-03

### Fixed
- **Stripchat streams still routed to external players after the CSP fix (only MPV played)** - `stripchatStreams` (`src/services/stripchatHls.ts`) set `behaviorHints: { notWebReady: true }` on every variant, telling Stremio to skip its internal player and hand off to external players, of which only MPV could play the live HLS. The `/stripchat/hls` proxy serves a standard, MOUFLON-decrypted HLS playlist with direct CDN segments - fully web-ready, the same shape debrid streams (`notWebReady: false`) play inline. Flipped the variant return to `notWebReady: false` so Stremio uses its internal hls.js player. The two `url: ''` error placeholders (pkey extraction failed / stale) keep `notWebReady: true` so Stremio doesn't try to play an empty URL inline. `tsc --noEmit` clean; 49 stripchat tests pass.

## [1.9.78] - 2026-07-03

### Fixed
- **Stripchat streams load but never play in the Stremio internal player** - the global CSP middleware added in 1.9.71 (`src/createExpressApp.ts`) set `Content-Security-Policy` (incl. `frame-ancestors https://web.stremio.com https://app.stremio.com https://stremio.com`) on every response, including the `/stripchat/hls/:username/:quality` and `/stripchat/seg` media-proxy responses. Stripchat stream URLs point at the addon's own proxy (unlike debrid streams, which point at external CDNs and never receive the addon CSP), so Stremio's player was handed a CSP-gated m3u8 - the playlist loaded but playback never started, and Stremio cycled through fallback players. CSP/frame-ancestors are document headers with no security value on non-HTML `application/vnd.apple.mpegurl` / `video/mp4` subresource responses. Fix: the global middleware now skips setting CSP on `/stripchat/*` paths (alongside the existing `/configure` HTML GET skip), so media proxies serve no CSP while every document/API route keeps it. Verified locally: `/stripchat/hls/...` returns 200 with no CSP and the playlist still decrypts; `/stream/...` and `/configure` keep CSP. `tsc --noEmit` clean; 53 stripchat tests pass.

## [1.9.77] - 2026-07-02

### Changed
- **14→12 provider-count sweep finished across the remaining docs and meta** - the initial 1.9.76 AllDebrid/PikPak removal missed ten lingering "14 debrid providers" strings: the `og:description` and `twitter:description` meta in `docs/index.html`, `docs/site/site.webmanifest`, `docs/site/og-image.svg`, `docs/providers-and-streams.md`, `docs/go-migration.md` (x2), `docs/code-structure.md`, `downloads/README.md`, and the `stremioGo.ts` header comment. All now read 12. Historical CHANGELOG entries that record the old 14-provider state are intentionally left as-is.

## [1.9.76] - 2026-07-01

### Changed
- **AllDebrid and PikPak removed as supported debrid providers (14 → 12)** - AllDebrid rejects magnet uploads from VPS/datacenter egress IPs (`NO_SERVER` block on the prod Hetzner IP), so installs with an `adKey` never got cached streams and only P2P ever showed; PikPak is dropped alongside to keep the provider set consistent. Removed `src/services/alldebrid.ts` and `src/services/pikpak.ts`, their `adKey`/`pkKey` entries from `DEBRID_PROVIDERS`/`DEBRID_KEY_FIELDS` (`src/utils/debridProviders.ts`), the `DebridKeyField` union + `AddonConfig` fields (`src/types/config.ts`), the `hasDebridKey` key list (`src/types/debrid.ts`), the `DEFAULT_CONFIG` keys + priority-order doc (`src/utils/config.ts`), and the two `DEBRID_TOKEN_UI` rows (`src/lib/configureConstants.ts`) so the configure page no longer renders either input. `src/services/debridScope.test.ts` is reframed to the Premiumize-only cache-key shape (scopeKey itself is unchanged and still used by the 11 remaining account-scoped providers). Advertised provider count updated from 14 to 12 across `package.json`, `README.md`, `docs/index.html`, `docs/providers-and-streams.md`, `docs/configuration.md`, `docs/code-structure.md`, `docs/development.md`, `docs/privacy.html`, and `downloads/README.md`, plus the `og:description`/`twitter:description` meta, `docs/go-migration.md`, `docs/site/site.webmanifest`, `docs/site/og-image.svg`, and `src/utils/stremioGo.ts`. Existing install URLs carrying an `adKey`/`pkKey` still parse (the fields are just ignored, never matched by the priority loop), so no installed addon breaks. `tsc --noEmit` clean; 231 tests pass.
- **Stripchat catalog defaults no longer auto-enable Guys and Trans** - the Stripchat panel (`src/components/configure/ConfigureApp.tsx` `stripchatCatalogs` initial state) shipped all four catalogs on by default (`sc_girls`, `sc_couples`, `sc_guys`, `sc_trans` all `true`), so a fresh install opted a new user into Guys and Trans cams without an explicit choice. Guys (`sc_guys`) and Trans (`sc_trans`) now default to `false`; Girls and Couples stay `true`. `src/lib/installBuilder.ts` reads the submitted `cat_sc_*` checkboxes with no all-on fallback, so the client default is the sole determinant for a fresh install. Saved profiles are unaffected (`useProfile` restores `stripchatCatalogs` by name with a null-check, so existing configs keep their own picks); only brand-new installs see the narrower default.

## [1.9.75] - 2026-07-01

### Changed
- **Configure left-nav restructured: Vault + Routing merged into one Sources & Keys tab, and the catalog tabs grouped under an always-expanded Catalogs heading** - the configure page had two separate first-run tabs (Vault for API keys + debrid tokens, Routing for active sources + MediaFlow proxy) and a flat list of catalog tabs with generic labels ("Library", "Scenes", "TPDB Tags"). They are now one Sources & Keys tab whose four cards render in a fixed order - Active Sources, Debrid Providers, ThePornDB & StashDB, MediaFlow Proxy - by relocating the cards into a new `src/components/configure/panels/SetupPanel.tsx` (the old `TokensPanel.tsx` and `StreamsPanel.tsx` are deleted). The catalog tabs (TPB Studios, PornRips, Stripchat, ThePornDB, StashDB Tags, Hentai, Sukebei) sit under a new always-expanded non-interactive Catalogs group header, driven by a `NAV_GROUPS` export in `src/components/configure/configureUiData.tsx` and rendered in `src/components/configure/ConfigureApp.tsx`; the group header hides when it has zero visible children. Labels renamed to name their source: Library -> TPB Studios, Scenes -> PornRips, TPDB Tags -> ThePornDB. New install defaults: Stripchat + PornRips sources and the TPDB catalog are on by default (`src/lib/configureProps.ts` enables the two sources only for the default `piratebay`/`all` `ADULT_SOURCE`; `enableTpdbCatalog` in `ConfigureApp.tsx` defaults to `envTpdbKey` so it is on when a server TPDB key exists). Every form `name=` attribute is unchanged, so `src/lib/installBuilder.ts` parsing and existing Stremio install URLs are unaffected; `useProfile` (`src/components/configure/useProfile.ts`) round-trips every field by name with null-checked restore, so saved profiles keep their own values and only brand-new installs see the new defaults. New `.tab-group` / `.tab.tab-sub` rules in `src/app/globals.css`. No new dependencies; `tsc --noEmit` clean; 231 tests pass; `next build` clean.

## [1.9.74] - 2026-07-01

_Supersedes 1.9.73 (the initial nonce release); 1.9.74 republishes it with no product change._

### Security
- **Configure UI no longer ships a dead, non-interactive page under strict CSP; inline flight scripts are now nonced per request** - the global CSP added in 1.9.71 (`src/createExpressApp.ts`, `script-src 'self'` with no `'unsafe-inline'` and no nonce) blocked Next.js's inline `self.__next_f.push(...)` flight scripts, so React never hydrated and `/configure` rendered static: the Account button didn't open the login dialog, and Routing/Library/Tuning/Contribute never loaded (confirmed live against tpb-adult-addon.click/configure, reproducible in Firefox + Chrome on Windows). Fix is a per-request nonce (Option B, keeping CSP strict rather than widening to `'unsafe-inline'`): new `src/proxy.ts` (Next.js 16 "proxy" file, the renamed middleware - placed under `src/` because the project has a `src/` dir, which is where Next looks for it; root-level `proxy.ts` is ignored) generates a 128-bit nonce (`crypto.getRandomValues(new Uint8Array(16))` base64), builds `script-src 'self' 'nonce-<nonce>'` (plus `'unsafe-eval'` in dev only), sets it on both the request CSP header (so Next.js SSR stamps the nonce on every inline `__next_f` script) and the response, and limits it to `/configure` + `/configure/install` via `config.matcher`. `src/app/configure/page.tsx` and `src/app/configure/install/page.tsx` declare `export const dynamic = 'force-dynamic'` (nonce injection requires per-request rendering; a static prerender bakes no nonce). `src/createExpressApp.ts` skips its own CSP on the HTML-producing GETs of those two paths only (scoped to `req.method === 'GET'` so the POST -> 302 install redirect still carries `frame-ancestors`), preventing a double CSP header (two are ANDed, which would re-block the inline scripts). Hardening applied to the nonce CSP: `form-action 'self'` (the configure form POSTs debrid/TPDB/StashDB keys and the page has a `dangerouslySetInnerHTML` sink, so restricting form submissions to same-origin blocks a rogue `<form>` exfil), `object-src 'none'`, `base-uri 'none'`. `Cache-Control: private, no-store` is set on both pages so a shared cache/CDN can't replay one visitor's nonce'd HTML - and more importantly can't cache `/configure/install`, which SSRs install URLs that embed debrid API keys. Nonce is never logged and never reaches backend proxies (matcher excludes `/manifest`, `/catalog`, `/meta`, `/stream`, `/_next/*`). Verified locally in dev + production: nonce present on all inline scripts (16 on /configure, 13 on /install), external chunks 200, no `'unsafe-eval'` in prod, per-request nonces differ, `next build` shows `ƒ Proxy (Middleware)` registered. No new dependencies; 231 tests pass.

## [1.9.72] - 2026-07-01

### Fixed
- **AllDebrid cached torrents now surface as cached streams instead of falling through to P2P** - the AllDebrid provider (`src/utils/debridProviders.ts`) was the only debrid provider with no quick resolve path and no prewarm (Real-Debrid has `resolveStreamsQuick` + `prewarm`; TorBox has `checkCached`). The interactive path called `resolveStreams`, which on a cache miss ran `waitForReady` polling for up to 2 min (`POLL_TIMEOUT_MS` in `src/services/alldebrid.ts`) but the stream route's 22s `DEBRID_RESOLVE_TIMEOUT_MS` killed it first, so users only ever saw the P2P entry, and `scheduleDebridPrewarm` was a no-op because `provider.prewarm` was undefined. Added `resolveStreamsQuick` (uploads the magnet and reads the `ready` flag from `POST /v4/magnet/upload`; on `ready=true` resolves and returns the cached files immediately, on `ready=false` returns `null` so P2P shows instantly and prewarm runs in the background) and `prewarmStreams` (background upload+poll+resolve that warms `streamCache`) to `src/services/alldebrid.ts`, and registered `resolveQuick` + `prewarm` on the AllDebrid provider entry. AllDebrid has no read-only instant-availability endpoint - `/v4/magnet/instant` returns `404 "Endpoint doesn't exist"` (verified against a live key across GET/POST, Bearer/apikey, and `magnets[]`/`magnets` param shapes), so the upload's `ready` flag is the cache signal; AllDebrid dedupes uploads of the same hash so a repeated check does not create a duplicate magnet. Also, the magnet sent to any debrid provider now includes `DEFAULT_TRACKERS` via a new `debridMagnet` helper in `src/routes/stream.ts` (the four debrid-upload sites: `debridStreamsForHash`, the isSb and infoHash paths in `streamsForCustomId`, and `scheduleDebridPrewarm`) so a cache miss that the provider then downloads can find peers; the P2P path is unchanged (it adds trackers via `magnetSources`). Cache hits match by infohash and ignore trackers. Mirrors the existing Real-Debrid path; no new dependencies, no new tests.

## [1.9.71] - 2026-07-01

### Security
- **Profile auth now fails closed when Stremio returns a user without an email** - `verifyAuthKey` (`src/routes/profile.ts`) previously trusted the client-supplied identifier when `getUser` returned a valid result with no `email` field, letting any authKey claim any user's identity. Profile slots are AES-GCM-encrypted with a key derived from the identifier, so the auth bypass exposed the slot key. `verifyAuthKey` now requires `getUser` to return a non-empty `email` AND match the claimed identifier; missing/empty/mismatched email returns `false`. The session map used for `getSession` lookups is also bounded: replaced an unbounded `Map` with `LRUCache<string, ...>({ max: 10_000, ttl: 10 * 60 * 1000 })` (lru-cache is already a dep, no new dependency). 4 new cases in `src/routes/profile.test.ts` pin the fail-closed behavior (no email = reject, matching email = accept, mismatched = reject, getUser error = reject).
- **AllDebrid and Premiumize cache keys are now scoped per account** - both `src/services/alldebrid.ts` and `src/services/premiumize.ts` built their resolved-files cache key as `ad:files:${infoHash}` / `pm:files:${infoHash}` with no account scoping, so a user A's resolved CDN links were served to user B for the same infoHash. Cache keys now thread `scopeKey(apiKey)` (a 16-hex-char SHA-1 digest of the api key) in front of the hash, producing `ad:files:${scopeKey(apiKey)}:${infoHash}`. 5 new cases in `src/services/debridScope.test.ts` pin the isolation (different keys for different apiKeys, same key for the same apiKey, stable 16-hex output, raw apiKey never appears in the digest, full cache key shape matches what the provider modules use).
- **Direct .torrent uploads block internal addresses (SSRF guard)** - the debrid provider modules accept a `torrentUrl` field on a jstrm id and upload it to the provider. `src/services/alldebrid.ts` `uploadTorrentFile` and `src/services/realdebrid.ts` `addTorrentFile` now route the URL through the existing `isSafeUrl` (RFC1918, link-local, loopback, IPv6 ULA, IPv6 link-local, IPv4-mapped IPv6, DNS rebinding via the `dnsLookupHook`) before fetching, so a crafted jstrm id pointing at `169.254.169.254`, `localhost`, or an internal service can't be used to make the addon fetch internal content and forward the body to the user's debrid account. Premiumize's direct upload path was already running through `isSafeUrl`; this is parity for the other two providers.
- **Install URLs and X-Addon-Base-Url pin to a single public host** - `src/lib/installBuilder.ts` now builds install URLs and `src/utils/stremioGo.ts` now builds the proxied `X-Addon-Base-Url` header against a `PUBLIC_HOST` constant (the deployed Sliplane hostname) instead of trusting the request's `Host` header. A request with a spoofed `Host: internal-target` can no longer leak the install URL/header to a non-public origin.
- **Body-size caps, CSP, security headers, constant-time admin token compare, same-origin guard on /api/profile, Stripchat HLS proxy stream error handling** - `src/createExpressApp.ts` adds CSP (frame-ancestors 'none', default-src 'self'), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and HSTS on HTTPS responses; `express.json({ limit: '32kb' })` on `/api/favorites` and `'4kb'` on the admin route; same-origin middleware (`sameOriginOnly`) on `/api/profile`; `crypto.timingSafeEqual` for the admin token compare (length-equalized first to avoid throwing); and try/catch stream error logging around the Stripchat HLS proxy response so an upstream teardown can't crash the worker. No new dependencies.

### Fixed
- **Cold TorBox cache no longer makes the P2P fallback take two minutes to appear on porndb catalog items** - `src/routes/stream.ts` `porndbStreams` called `debridStreamsForHash` without a timeout, so a cold TorBox torrent (TorBox's `waitForReady` polls for up to 120s via `POLL_TIMEOUT_MS` in `src/services/torbox.ts`) blocked the stream response for the full two minutes, then fell through to the P2P entry. Wrapped the call in the existing `withTimeout(..., DEBRID_RESOLVE_TIMEOUT_MS = 22_000, 'debrid stream resolution')` helper (same constant the jstrm: path uses) and added a `.catch` that logs and returns `[]`, so a timeout produces a normal P2P stream within ~22s instead of 120s. The outer `handleStream` `.catch(() => [])` at the call site was already in place, so no other changes were needed. No new constants, no new tests (timeout behavior mirrors the existing jstrm: pattern).

## [1.9.70] - 2026-06-30

### Changed
- **Saving a config with a name that already exists now prompts to overwrite instead of failing** - the `/api/profile/slots/save` route (`src/routes/profile.ts`) returned a 409 and the configure UI showed a blocking error when a slot name collided with an existing saved config, so re-saving under the same name required deleting the old one first. `saveProfileSlot` (`src/utils/profileStore.ts`) now takes an `overwrite = false` param (still returns `'duplicate'` when the flag is off, overwrites in place when it is on) and the route reads `overwrite` from the request body and passes it through. The Save button (`src/components/configure/ConfigureApp.tsx`) calls `useProfile`'s `handleSlotSave()`; on a 409 the hook sets `pendingOverwriteSlot` instead of showing an error, which renders a new `OverwriteConfirmModal` (`src/components/configure/ProfileModal.tsx`, portaled to `document.body`, independent of the account modal since the Save button lives in the main form) asking "Overwrite config?" with Cancel / Overwrite actions; confirming re-submits with `overwrite: true`. No new dependency; existing AES-256 slot encryption and the duplicate-guard default (no overwrite without explicit confirm) are unchanged.
- **Account modal restyled to match the app's design tokens (no behaviour change)** - `ProfileModal` (`src/components/configure/ProfileModal.tsx`) used inline styles with dead CSS fallbacks (`--bg-card`, the purple `#7c6af7` accent) that never resolved, so the modal read visually off against the rest of the configure page (real tokens are `--surface`/`--accent` #FF6A3D/`--danger` #FF5C5C). All inline styles are replaced with new `.acct-*` / `.cfrm-*` classes in `src/app/globals.css`, built on the existing token set: a header row with an accent-tinted user icon, `.field-input`/`.field-label` reuse for the email/password fields, a signed-in identity row with a destructive (red) Sign out, slot rows with a rotating chevron, and Load (primary) / Delete (destructive, red) actions. Added a modal entrance animation (`modalIn` scale+fade, ~220ms) with a `prefers-reduced-motion` opt-out, `:focus-visible` rings on every interactive element, an `aria-live` status region, and SVG icons (close, user, chevron, alert) replacing the old ×/▲▼ glyphs. Every prop, handler, state, the signed-in/signed-out flow, the security note with the revoke link, and the AES-256 framing are unchanged - this is a visual pass only.

## [1.9.69] - 2026-06-29

### Changed
- **Manifest building consolidated to the Go backend; the edge fallback `buildManifest` is removed** - the edge carried a full duplicate of the backend's catalog assembly in `src/manifest.ts`, used only as a fallback when `BACKEND_URL` was unset (and it had drifted: it still sorted XXX/Trans into the studio block). The Go backend (`torrent-search-go`) is now the single source of truth: both manifest routes in `src/createExpressApp.ts` proxy to it unconditionally and return HTTP 502 `{ error: 'backend unavailable' }` when the proxy can't serve (no local build). The no-config `/manifest.json` proxies the backend's `default` manifest. Verified the Go manifest provides every field the edge did (`stremioAddonsConfig`, `idPrefixes`, etc.). Removed `buildManifest` and the catalog-building helpers it alone used: `src/utils/externalCatalogs.ts` (whole file), `getAdultCatalogs`/`compactStudioCatalogs`/`compactMainCatalogs` (adultSections), `getPornripsManifestCatalogs` (pornripsCatalogs), `categoryNames` + the `tpdb_cat`/`stashdb_cat` id constants (categoryCatalogs), `fetchStudios` (services/backend) and the now-orphaned `sectionCache` (utils/cache). `manifest.ts` now exposes only `ADDON_NAME`/`ADDON_VERSION`/`PROVIDERS`. `tsc --noEmit` clean; 222 tests pass; `next build` clean; live smoke test confirms both routes proxy and 502 on unset backend.
- **StashDB configure panel marks Petite/Ebony/Pissing as low-result, and Ebony is no longer default-enabled** - a catalog audit (`torrent-search-go` `cmd/tpbaudit`) found these three StashDB category catalogs return sparse streamable counts (Petite 0, Ebony 3, Pissing 8). The StashDB Category Picks panel (`src/components/configure/panels/StashdbCatPanel.tsx`) now renders a muted "Low results on StashDB" note (reusing the existing `.sw-row-desc` style, no new CSS) under each of those three options so users know to expect few results before opting in. The low-result slug set is exported from `src/utils/categoryCatalogs.ts` (`STASHDB_LOW_RESULT_SLUGS` / `isStashdbLowResult`) alongside the curated category list; it is static (genuine data sparseness, not alias mismatches - re-audit if StashDB coverage shifts). Ebony's `default` flag is also flipped to `false` there (Petite/Pissing were already `default: false`), mirroring the `Default: false` flip in the Go backend (`internal/services/jobs/category_catalogs.go`) so a fresh install with no `stashdbCategories` set no longer surfaces Ebony by default; `pr_tag` is unaffected (it lists all categories regardless of the default flag and Ebony has 1552 results there). Petite/Pissing/Ebony remain available as opt-in picks.

### Fixed
- **XXX and Trans now lead the board on multi-part installs instead of appearing mid-list (after the last part-1 studio)** - the backend change that sorts the main XXX/Trans browse catalogs into the first (non-studio) board block left `buildInstallInstances` (`src/lib/installBuilder.ts`) chunking by the old assumption (XXX/Trans sorted within the studio block), so they were assigned to a later part and surfaced after part 1's last studio (e.g. "after PervMom"). The selected piratebay bases are now partitioned main-first - XXX/Trans (`!base.startsWith('xxx_studio_')`) ahead of the studios, each block alphabetical - so they land at the front of part 1; the backend's per-part sort then composes a globally alphabetical board. Test updated to assert XXX/Trans lead part 1 and never appear in later parts, with studios globally alphabetical across parts.

## [1.9.68] - 2026-06-28

### Fixed
- **Extra indexers + 1337x search toggles now render directly under the HiddenBay source row** - the prior 1.9.67 note claimed they "already nest under HiddenBay" and no move was needed, but that was wrong: the `sources['piratebay'] &&` block was emitted *after* the entire `primarySources.map` in `src/components/configure/panels/StreamsPanel.tsx`, so positionally it landed at the end of the Active Sources list (below Stripchat), not below HiddenBay. The block is now rendered inside the map, gated on `s.value === 'piratebay' && sources['piratebay']`, with each source row wrapped in a `React.Fragment` keyed by `s.value`. Visibility is unchanged (still only shown when HiddenBay is enabled); only the position moved. `tsc --noEmit` clean.

## [1.9.67] - 2026-06-28

### Changed
- **Extra indexers and 1337x search copy updated; both already nest under the HiddenBay source row** - the two toggles already rendered inside the `sources['piratebay'] &&` block in `src/components/configure/panels/StreamsPanel.tsx` (the `piratebay` source is labelled "HiddenBay" in `configureConstants.ts`), so they already sit under the HiddenBay source entry and no structural move was needed. The "Extra indexers" description now folds in the low-resolution caveat and the separate conditional `<p>` Note is removed as redundant: "Add Knaben & Bitsearch to search, plus XxxClub to browse. Lower debrid hit rate - more volume. Enabling this also surfaces lower-resolution streams regardless of your 1080p or 4K catalog selection." The "1337x search" description drops the Cloudflare/slowness/caching framing (flaresolver is no longer used and is not mentioned) in favour of a plain source description: "Include 1337x results in search. Adds a broad general torrent index for extra coverage." `tsc --noEmit` clean.

## [1.9.66] - 2026-06-28

### Fixed
- **Multi-part installs no longer duplicate TPDB/StashDB catalogs, and chunks are alphabetically adjacent so the global board sorts correctly across parts** - `buildInstallInstances` (`src/lib/installBuilder.ts`) baked TPDB/StashDB category arrays into `sharedCfg`, so every part of a split install re-emitted those catalogs; combined with the Go backend appending the dedicated Search catalog whenever `piratebay` was a source (every part has it), a multi-part install showed TPDB, StashDB, and Search duplicated across every part, and the per-part sort could not compose a globally alphabetical board. TPDB/StashDB categories now resolve for part 1 only (`idx === 0`); parts 2..N send an explicit empty array (`tpdbCategories: []`, `stashdbCategories: []`) so the backend suppresses them there. The empty array is load-bearing: when the field is omitted and a tpdb/stashdb key is present (the key rides `sharedCfg` on every part), the backend fills default non-empty categories and re-emits TPDB/StashDB on every part, so omitting would not dedup. The selected piratebay bases are now sorted by display name (case-insensitive ASCII `toLowerCase`, matching the Go backend's `sortCatalogsByName`) before chunking, so each part holds an alphabetically-adjacent range; the backend's per-part sort then composes a globally alphabetical TPB-Studio block when parts are installed in order. Paired with the Go backend Search-dedup fix (`cfg.Group <= 1`) and an explicit-empty-`TpdbCategories` suppression contract test so a multi-part install, parts installed in order, yields a globally sorted board: non-TPB-Studio catalogs first (alphabetical, part 1 only), then TPB-Studio catalogs (alphabetical across all parts). `tsc --noEmit` clean; 222 tests pass (3 new `buildInstallInstances multi-part split` cases).

## [1.9.65] - 2026-06-28

### Changed
- **Catalog board ordering: non-TPB-Studio catalogs first, then TPB-Studio, each alphabetically** - the Stremio home/discover board previously listed catalogs in fixed source order (TPB, then PornRips, Hentai, Sukebei, Stripchat, TPDB/StashDB) with no sort, so installed catalogs appeared unsorted. The fallback manifest builder (`src/manifest.ts`, used only when `BACKEND_URL` is unset) now sorts the non-TPB-Studio block (PornRips, Hentai, Sukebei, TPDB/StashDB) alphabetically by display name, then the TPB-Studio block (all piratebay-sourced catalogs, incl. the dedicated Search catalog) alphabetically, concatenating non-studio first. The comparator is case-insensitive ASCII (`toLowerCase` compare, not `localeCompare`) so it matches the Go backend's `BuildManifest` byte-for-byte regardless of runtime locale. The live path is unaffected (the edge proxies the Go manifest verbatim and only stamps the version); this is fallback parity with the backend change shipped in the same release. `tsc --noEmit` clean; 219 tests pass.

## [1.9.64] - 2026-06-27

### Added
- **VR + Ebony studio sections and 30 new studios** - the configure page gains two new studio sections (VR Studios, Ebony Studios) alongside the existing Gay / Lesbian / Trans / JAV groups. `STUDIO_GROUP_DEFS` (`src/lib/configureConstants.ts`) adds `vr` and `ebony` keys, and `studioOrientation()` (`src/utils/adultSections.ts`) routes studios to them via new `VR_STUDIOS` / `EBONY_STUDIOS` Sets. 30 studios verified against thehiddenbay.com (fresh page-1 recent results) added to `STUDIO_PRESETS`: Gay +6 (BoyFun, CockyBoys, Staxus, Latin Boyz, Hardkinks, Why Not Bi, all 1080p-only), VR +12 (VRBangers, BadoinkVR, VirtualRealPorn, SexLikeReal, CzechVR, WankzVR, NaughtyAmericaVR, VRHush, DarkRoomVR, MilfVR, RealJamVR, VRAllure; all 4K + 1080p except NaughtyAmericaVR which is 1080p-only), Ebony +12 (RoundAndBrown, BrownBunnies, GhettoGaggers, We Fuck Black Girls, Gloryhole Initiations, WatchingMyMomGoBlack, Cumbang, BlackValleyGirls, Evasive Angles, West Coast Productions, Black Ice, Pinkyxxx; only BrownBunnies has 4K). `STUDIO_1080P_ONLY` updated for the 18 1080p-only additions. Interracial brands (BlacksOnBlondes, DarkX) are NOT ebony and were excluded; generic word-AND search traps (Big Booty, Ebony Sex, Cum Bang, etc.) were rejected as false positives. Selection stays per-base, so no install-handler changes were needed. Mirrored in the Go backend (`torrent-search-go/internal/stremio/sections.go` + `studioSearchTerms.json`) so the background catalog-cache warmer prefetches the new studios. `tsc --noEmit` clean; 219 tests pass.

## [1.9.62] - 2026-06-27

### Fixed
- **Maintenance / Down badges now cover TPDB and StashDB** - the initial 1.9.61 pass only mapped the five primary sources, so TPDB/StashDB never badged even when the dashboard flipped them to `MAINTENANCE`/`DOWN`. `src/lib/addonStatus.ts` `REPORT_TO_KEY` now also maps `tpdb` -> `tpdb-cat` and `stashdb` -> `stashdb-cat`. The configure tab badge uses `tab.sourceKey || tab.id` so the `tpdb-cat` / `stashdb-cat` tabs (which have `sourceKey: null`) badge correctly. `TokensPanel` now badges the "ThePornDB API token" and "StashDB API key" field labels from `sourceStatuses`, and `TpdbCatPanel` / `StashdbCatPanel` badge their "TPDB Category Picks" / "StashDB Category Picks" headings. `tsc --noEmit` clean; 219 tests pass.

### Changed
- The non-LIVE source pill now reads **WIP** instead of "Maintenance" - the longer label overflowed on narrow tab/section widths. The API status value (`MAINTENANCE`) and CSS classes (`tab-maint` / `src-maint`) are unchanged; only the visible text is shorter.

## [1.9.61] - 2026-06-27

### Added
- **Maintenance / Down status badges in the configure UI** - the configure page now fetches the Go backend's public `/api/addon-status/tpb-4k-porn` report (the same API the adult-addons site uses) and badges any source the dashboard has flipped to `MAINTENANCE` (amber) or `DOWN` (red). Badges appear on the source tab, the Routing "Active Sources" row, and each catalog section heading in the source's panel, mirroring the existing Beta tag style. New `src/lib/addonStatus.ts` (`getSourceStatuses()` reads `BACKEND_URL`, ISR 60s, 3s abort, returns an empty map on any error or unset `BACKEND_URL` so the page never breaks). `getConfigureProps()` is now async and threads `sourceStatuses` through `ConfigureApp`, `StreamsPanel`, `ToggleRow`, and the five source panels (`CatalogsPanel`, `PornripsPanel`, `HentaiPanel`, `SukebeiPanel`, `StripchatPanel`). Report source ids map `tpb` -> `piratebay`, the rest 1:1. `tsc --noEmit` clean; 219 tests pass.

### Changed
- **Hentai source renamed to HentaiMama** in the configure UI tab and the Routing source picker. Internal `hentai` id, catalog ids, and install URL params are unchanged, so existing installs keep working; README feature line updated.
- **StashDB invite pointer** now links to the StashDB access guide (`guidelines.stashdb.org/.../accessing-stashdb/`) instead of "Discourse/Discord", in the configure Tokens panel, the `utils/config.ts` comment, and `docs/configuration.md`.
- **Stripchat Beta tag removed** from the source tab, the Routing source row, and the Stripchat catalog panel banner (graduated from beta).

## [1.9.60] - 2026-06-27

### Removed
- **HentaiTV dropped from the Hentai source** - HentaiTV (`htv-`) was scope creep from the original HentaiMama-only implementation; the configure page (HentaiPanel) only ever advertised "episodes from HentaiMama", and HentaiTV's r2.1hanime.com CDN 403s every request from the backend IP (Cloudflare-fronted, signed-URL embeds that never resolved server-side), so every `htv-` item surfaced "no streams". Removed `htv-` from the manifest `idPrefixes` (kept `hs:` for backcompat and `hmm-` for HentaiMama), and the stream route now proxies only `hs:`/`hmm-` ids to Go (the `/^h(mm|tv)-/` regex is replaced with `id.startsWith('hmm-')`). Go-side scrapes, ingest, catalog, meta, stream, and Mongo reads are likewise HentaiMama-only and filter every read to `prefix:"hmm"` so the ~1550 leftover `htv-` docs in prod `hentai_entries` never surface (no re-ingest needed). HentaiMama (`hmm-`) streams resolve via the DooPlay AJAX flow as before. `tsc --noEmit` clean; 219 tests pass.

## [1.9.59] - 2026-06-27

### Changed
- **Hentai edge reduced to a pure Go proxy (Phase D)** - the Node edge no longer ships its own Hentai scraper. `src/services/hentai.ts` is deleted (the `getMeta`/`getEpisodeStreams`/`filterCatalogMetas` worker-proxy calls, the alive/dead cover+stream probe, and the proxied catalog cache). The stream route now proxies `hs:`/`hmm-`/`htv-` ids straight to the Go backend's `/stremio/{config}/stream/...` handler via `fetchGoStreams` (Go self-scrapes HentaiMama `hmm-` and HentaiTV `htv-` and resolves direct mp4 URLs, Phase C); the `hentaiStreams`/`hentaiEpisodeStreams`/`isHentaiEpisodeId` helpers are removed. `stremioGo.ts` drops the Hentai catalog post-filter (`filterCatalogMetas` + `isHentaiCatalogSubpath`) - Go's Mongo rows already carry valid covers. `cache.ts` drops the now-unused `hentaiCatalogCache` (`cat:hs:v1:`), `hentaiDeadCache` (`hs:dead:v3:`), `hentaiAliveCache` (`hs:alive:v3:`), and `TTL_PROXIED_CAT`. `externalCatalogs.ts` drops the dead `getHentaiBases`/`hentaiTheirCatalogId` (the worker-catalog-id map is obsolete); `HENTAI_CATALOGS` + `getHentaiManifestCatalogs` are kept (the edge still assembles the manifest). The manifest `idPrefixes` adds `hmm-`/`htv-` so Stremio routes hentai episode stream requests to the edge (and on to Go); `hs:` stays for backcompat (legacy `hs:` ids resolve to no streams, deprecated), `hse-` was never declared here. Sync comments added in both repos: edge `HENTAI_CATALOGS` matches Go `internal/stremio/manifest.go hentaiCatalogDefs()`, and edge `idPrefixes` matches Go `idPrefixes`. Configure UI, HentaiPanel, and the `hentai` source toggle are unchanged. `tsc --noEmit` clean; 219 tests pass.

## [1.9.58] - 2026-06-26

### Removed
- **PornTube dead code** - PornTube was never wired as a configurable source (no `porntube` source key, no `pt_` catalogs emitted, `pt:` absent from `idPrefixes`), so the `pt:` stream branch was unreachable and the surrounding code was dangling. Deleted `src/services/porntube.ts`, the `pt:` dispatch + `porntubeStreams` in `src/routes/stream.ts`, the `PORNTUBE_CATALOGS` / `getPorntubeManifestCatalogs` / `getPorntubeBases` / `porntubeTheirCatalogId` exports in `src/utils/externalCatalogs.ts`, the unused `porntubeCatalogCache` (`cat:pt:v1:`) in `src/utils/cache.ts`, and the `PORNTUBE_GENRES` key in `src/utils/externalGenres.json`. Updated README + docs to drop PornTube references. No behavior change (the prefix was never produced).

## [1.9.57] - 2026-06-26

### Changed
- **Contribute section headings** - renamed the directory link title from "Stremio adult addons directory" to "TPB 4K - Adult Addons directory" and the docs link title from "Addon docs site" to "Addon GitHub site" so both cards name what they actually link to.

## [1.9.56] - 2026-06-26

### Changed
- **Contribute section adult-addons link** - the directory link now points at the addon's own page on the adult-addons site (`https://adult-addons.click/tpb-4k-porn`) instead of the site root, and its icon is the adult-addons site logo (the A mark in its real white + pink) instead of the previous custom circle glyph.

## [1.9.55] - 2026-06-26

### Changed
- **PornRips un-enriched streams skip the backend round-trip** - the Go backend is now Mongo-only for PornRips, so it returns `streams:[]` for `jstrm:` items that lack an infoHash until the background `PornripsSync` job backfills the hash. The edge (`stream.ts` `resolveOneRecord`) now early-returns an empty stream list for `record?.w === 'pornrips' && !record?.h` instead of calling `fetchGoStreams` for that empty result, removing a now-useless backend round-trip per click on an un-enriched PornRips item. Enriched items (payload carries `h:<infoHash>`) keep the fast debrid/P2P path unchanged. Deleted the orphaned `pornripsMagnetCache` (`prmagnet:v1:`) in `src/utils/cache.ts` - it had no callers after the v1.9.50 edge scraper deletion.

## [1.9.54] - 2026-06-25

### Changed
- **Internal refactor (no behaviour change)** - decompose the `ConfigureApp.tsx` god component (833 -> 505 lines) by extracting each tab's render JSX into a presentational panel under `src/components/configure/panels/` (`CatalogsPanel` with an internal `StudioGroup`, `PornripsPanel`, `TokensPanel`, `StreamsPanel`, `DisplayPanel`, `TpdbCatPanel`, `StashdbCatPanel`, `HentaiPanel`, `SukebeiPanel`, `StripchatPanel`, `ContributePanel`). All state, refs, memos, effects, handlers, `buildProfile`/`loadFromProfile`, `useProfile`, and `handleSubmit` stay in the parent; panels receive state/handlers/refs as typed props. Same ref objects, same form field `name`/`id`/`data-*` attributes, same `.panel.active > .card:nth-child(N)` ordering. Typecheck 0, 219 tests green, `next build` succeeds.

## [1.9.53] - 2026-06-25

### Changed
- **Internal refactor (no behaviour change)** - consolidate debrid-service plumbing duplicated across 14 providers into `src/services/debridUtils.ts`: the `VIDEO_EXT` matcher (shared by all 14), the `scopeKey` sha1 cache-key namespacer (11 services; Real-Debrid keeps its own because it mixes in the user IP), and a `cachedResolve` get-or-resolve-then-set helper (11 services). debridlink/torbox keep their local cache get/set (they store a `{torrentId, files}` meta entry and return a derived value) and Real-Debrid keeps its local `scope` + cache (partial `existing` re-cache on hit). Cache keys, TTL (default), guard truthiness, and throw-on-empty semantics are unchanged.

## [1.9.52] - 2026-06-25

### Changed
- **Internal refactor (no behaviour change)** - extract the profile/account feature out of `ConfigureApp.tsx` into a `useProfile` hook (`src/components/configure/useProfile.ts`) + `ProfileModal` portal component (`src/components/configure/ProfileModal.tsx`), and pull the static tab/icon data and the install-count note helpers into `configureUiData.tsx` + `src/lib/installCountNote.ts` (with unit tests). State, effects, fetch handlers, and rendered markup move verbatim; `buildProfile`/`loadFromProfile` stay in the parent. No user-facing change.

## [1.9.51] - 2026-06-25

### Changed
- **Internal refactor (no behaviour change)** - replace `as any` casts with typed casts in Real-Debrid stream-cache reads (`DebridFile[] | undefined`), the `stream.ts` group-id flatten (`StremioStream[]`), and the LinkSnappy `ADDURL` torrent lookup. Pure type narrowing; runtime values unchanged.

## [1.9.50] - 2026-06-25

### Changed
- **PornRips stream resolution** - the edge no longer ships its own PornRips scraper. PornRips catalog items that lack an infoHash (not yet in the Mongo store) are now resolved through the Go backend (`fetchGoStreams`), the same path `porndb:` IDs already use: the backend live-resolves the `.torrent`, extracts the infoHash, and writes it back to the `pornrips_entries` Mongo store so the next catalog open for any user carries the hash and skips the live fetch. Enriched items (payload already carries `h:<infoHash>`) keep hitting the edge's fast debrid/P2P path. Deleted `src/services/pornrips.ts` (`resolveDownloadUrl`/`fetchDownloadLinks`/`browseAdult`/`searchAdult`) and the dead `resolvePornripsTorrentUrl`/`isPornripsItem` blocks in `stream.ts`. Requires `BACKEND_URL` (always set on this edge, which proxies catalog/meta/porndb through the Go backend).

## [1.9.49] - 2026-06-25

### Fixed
- **PornRips streams** - PornRips catalog items showed no streams on the Node edge because the detail-page scrape is Cloudflare-blocked from the Sliplane cloud IP (the page fetch returns null) and `fetchDownloadLinks` returned empty before any fallback. It now falls back to the `pornrips.to/torrents/{release}.torrent` pattern whenever the detail page yields no magnet/`.torrent` link (including the null/Cloudflare-blocked case), downloading it with a Chrome UA + Referer (no `Accept-Encoding`, so the `.torrent` buffer isn't gzip-corrupted) and extracting the infoHash. The release name is the `jstrm` payload title (the WP post title, which IS the `.torrent` filename stem), threaded through `resolvePornripsTorrentUrl` -> `resolveDownloadUrl` -> `fetchDownloadLinks`. Mirrors the Go backend's `FetchTorrentData` fallback.

## [1.9.48] - 2026-06-25

### Fixed
- **PornRips streams** - introduce the `pornrips.to/torrents/{release}.torrent` fallback when the detail-page scrape yields no magnet/`.torrent` link, threading the `jstrm` payload title (the WP post title, which is the `.torrent` filename stem) through `resolvePornripsTorrentUrl` -> `resolveDownloadUrl` -> `fetchDownloadLinks` and fetching the standard `.torrent` URL with the Chrome UA + Referer. Initial pass; the Cloudflare-blocked (null) case and the `Accept-Encoding` fix land in 1.9.49.

## [1.9.47] - 2026-06-23

### Changed
- **Configure UI** - move Hide P2P fallback toggle to the top of the Debrid Providers section.

## [1.9.46] - 2026-06-23

### Changed
- **Stripchat source** - configure description lists Stripchat network white labels (xhamsterlive.com, spankbanglive.com, topcams.tv, vr.stripchat.com, Stripcash domains) and notes they share the same models and HLS streams.

## [1.9.45] - 2026-06-23

### Fixed
- **Build** - type Mongo cache collection with string `_id` keys so `mongoCache` queries typecheck after lazy Mongo init.

## [1.9.44] - 2026-06-23

### Fixed
- **Saved configs** - lazy Mongo connect and runtime `SESSION_SECRET` lookup so profile lists work after deploy (module import no longer freezes wrong DB or encryption key).

## [1.9.43] - 2026-06-23

### Fixed
- **Saved configs** - harden Stremio `getUser` verification, merge missing slots from legacy `authKey` buckets, persist Account sessions across reloads, and clear stale slot-list errors so saved configs are accessible again after deploy.

## [1.9.42] - 2026-06-23

### Fixed
- **Account modal** - portal to `document.body` so it stays viewport-centered after saving at the bottom of the page (`.container`'s `transform` animation trapped `position: fixed` children).

## [1.9.41] - 2026-06-22

### Fixed
- **Manifest build** - restore `ADDON_ID` and `ADDON_NAME` constants removed during the description refactor (Sliplane deploy typecheck).

## [1.9.40] - 2026-06-22

### Added
- **Stripchat HLS proxy** - HLS stream proxy with pkey auto-extraction, CDN host allowlist, advert-placeholder detection and auto-refresh. Requires Playwright for extraction.

### Fixed
- **Saved configs** - verify Stremio sessions via `api/getUser` (not the empty `userData` response), restore authKey-to-email migration, normalize email identifiers, and merge mixed-case email buckets so Account loads work across browsers and pods.
- **Account** - surface slot-list API errors in the UI instead of showing an empty saved-config list.
- **Stripchat playback** - decrypt MOUFLON segment URLs (use known pkey/pdkey pairs) so HLS segments resolve instead of looping on `media.mp4` placeholders.
- **Stripchat streams** - return absolute HLS proxy URLs so Stremio lists playable stream entries (relative `/stripchat/hls/...` paths were ignored).
- **Stripchat streams** - use `/api/front/v1/broadcasts/{user}` instead of the retired `/username/{user}/cam` endpoint (HTTP 406), restoring meta and HLS stream resolution.
- **Stripchat pkey** - extract the active pkey from master m3u8 MOUFLON tags (no Playwright); append `psch=v2` on playlist fetches.
- **Stripchat HLS proxy** - fetch variant playlist URLs directly instead of rebuilding a bogus master path.
- **Stripchat HLS route** - resolve TypeScript build errors (`string | string[]` params, `ReadableStream.pipe`).

### Changed
- **Manifest description** - mentions PornRips scenes, Sukebei, Stripchat live cams (multi-quality HLS), and HiddenBay by name.
- **PornRips source** - removed Beta label from the configure page source toggle and Scenes catalog tab.
- **Stripchat MOUFLON keys** - load pkey/pdkey pairs from `PD_KEY_*` env vars (`pkey:pdkey`) instead of hardcoding in source.
- **Stripchat streams** - list one entry per available resolution (1080p, 720p, 480p, 240p) so Stremio can pick quality.
- **Stripchat HLS** - serve decrypted playlists with direct `media-hls.doppiocdn.com` segment URLs instead of proxying bytes through `/stripchat/seg` (fixes constant rebuffering).
- **Save config button** - now shows loading spinner and inline success/error message; was silently completing with no feedback. Button text and status message are now centered.
- **Profile identifier** - configs now keyed by email instead of authKey, so saved configs are accessible across browsers and incognito sessions. authKey is verified against Stremio on each request (cached 1 h) to confirm identity.
- **Account modal** - login button shows spinner while authenticating; saved configs are collapsible (click to expand Load/Delete actions); Save config button moved to main submit bar next to Generate Install URLs (visible when signed in); save section removed from modal.
- **Account modal** - replaced raw auth-key input with Stremio email/password login; credentials go directly to Stremio's API (`api.strem.io`), only the returned `authKey` is used as the profile identifier. Modal shows a privacy note explaining encryption and links to Stremio session settings for revoking access. Supports multiple named configurations per account, identified by the addon name postfix; saving with a duplicate name is rejected.

## [1.9.21] - 2026-06-22

### Added
- **Stripchat source** - configure-page source toggle and four live cam catalogs (Girls, Couples, Guys, Trans) with username search; `sc:` meta id prefix.
- **Saved Config (Account)** - "Account" button in the configure header opens a modal where you enter your Stremio auth key to save or restore all settings (debrid keys, catalog toggles, studio selections). Config is AES-256-GCM encrypted in MongoDB; requires `MONGODB_URI` and `SESSION_SECRET`.

### Fixed
- **Search catalog** - new installs use catalog id `search` and display name `Search` under Porn (legacy `jav_search` still served by the backend).
- **Extra indexers streams** - results from Knaben, Bitsearch, and XxxClub no longer get filtered to the catalog's quality scope (1080p/4K), so streams actually appear; only the 480p floor still applies. Configure page shows a note when extra indexers is enabled.
- **Stream ordering** - streams are now sorted highest quality first (4K > 1080p > 720p) across all stream types.

## [1.9.14] - 2026-06-22

### Fixed
- **Configure install** - XXX 4K/1080p and Trans catalog toggles now submit with the form (visible `ToggleRow` `name` attributes instead of non-submitting read-only mirrors).

## [1.9.13] - 2026-06-22

### Added
- **Trans quality toggles** - separate Trans 4K and Trans 1080p configure toggles; compact Trans catalog support.

### Changed
- **Compact studios** - main XXX catalog included in compact studio mode.

## [1.9.12] - 2026-06-22

### Fixed
- **Configure** - XXX 4K/1080p quality toggles no longer flip unrelated studio checkboxes.

## [1.9.10] - 2026-06-22

### Added
- **Tests** - coverage for `decodeGroupId` / `encodeItemId` quality branch.

## [1.9.9] - 2026-06-22

### Changed
- **Compact studios** - `jstrg:` group IDs resolve to one stream per quality tier.

## [1.9.8] - 2026-06-22

### Added
- **Compact studio catalogs** - optional configure toggle to merge studio scenes into grouped catalog entries.

## [1.9.7] - 2026-06-22

### Changed
- **Configure** - clarified 1337x opt-in toggle description.

## [1.9.5] - 2026-06-22

### Changed
- **Copy** - replaced em/en dashes with ASCII hyphens in public-facing text.

## [1.9.4] - 2026-06-22

### Fixed
- **Manifest** - Node edge stamps live `ADDON_VERSION` onto Go-proxied manifest so Stremio shows the current addon version.

## [1.9.3] - 2026-06-22

### Added
- **Extra indexers** - configure toggles for Knaben, Bitsearch, and 1337x (opt-in).
- **Quality stream filter** - stream handler drops mismatched resolutions for fhd/4k catalog IDs.

## [1.9.2] - 2026-06-22

### Changed
- **Static assets** - cache `public/` for 7 days instead of `max-age=0`.

## [1.9.1] - 2026-06-22

### Fixed
- **Install flash store** - shared across Express/Next bundle; corrected cookie `maxAge` unit.

## [1.9.0] - 2026-06-22

### Added
- **Version guardrails** - `addon-version.mjs` pre-commit auto-bump and regression block; cross-agent bump skill.
- **Install flash store** - server-side flash data to bypass the 4 KB cookie limit on large configure payloads.
- **TPDB/StashDB category catalogs** - improved adult metadata matching.

### Changed
- **Architecture** - thin Stremio edge; catalog/search/stream protocol offloaded to Go backend when `BACKEND_URL` is set.
- **TypeScript migration** - Express routes and configure UI rewritten in TypeScript/Next.js.

## [1.8.5] - 2026-06-14

### Added
- **PornTube + HentaiStream sources** - additional adult source tabs with Beta labels.
- **StashDB metadata** - field-level merge with TPDB; background enrichment jobs.
- **Docs site** - open-source landing page, GPL license, Discord/Ko-fi links.

### Fixed
- **PornRips** - empty catalogs, duplicate labels, broken covers, stream infoHash extraction, 429 storms on TPDB.

## [1.8.0] - 2026-06-13

### Added
- **14 debrid providers** - unified stream resolver (Real-Debrid, TorBox, Premiumize, AllDebrid, and others).

## [1.7.2] - 2026-06-06

### Changed
- **Addon identity** - debrid provider always shown in installed addon name and manifest ID.

## [1.7.1] - 2026-06-06

### Added
- **Trans category** - Trans 4K/1080p catalogs and custom addon name postfix.

## [1.7.0] - 2026-06-06

### Added
- **JAV catalogs** - censored and uncensored sections on configure page.

## [1.6.0] - 2026-06-06

### Added
- **Orientation splits** - gay/lesbian studio groupings on configure.
- **MediaFlow Proxy** - optional stream URL proxying.
- **Porn content type** - catalogs exposed under custom Stremio `Porn` type.
- **User IP forwarding** - sent to debrid APIs; caches moved Redis-only.

## [1.5.3] - 2026-06-21

### Fixed
- **PornRips search** - browse-and-filter fallback when Cloudflare blocks `?s=` queries.

## [1.5.2] - 2026-06-20

### Fixed
- **PornRips metadata** - improved coverage on catalog cards and detail pages.

## [1.5.1] - 2026-06-20

### Fixed
- **PornRips search** - live TPDB/StashDB enrichment and search fallback fixes.

## [1.5.0] - 2026-06-20

### Added
- **Sukebei source** - optional Nyaa Sukebei catalogs with StashDB-assisted top/recent.

### Changed
- **Beta labels** - dropped from mature sources where stability improved; PornRips retains Beta where needed.
- **JAV search** - renamed to Porn; XXX catalogs browse-only (no search extra).

## [1.3.1] - 2026-06-02

### Added
- **Rate limiting** - per-IP limits and DDoS backstop on Stremio endpoints.
- **Multi-instance install** - separate addon instances per debrid provider and catalog group.

## [1.3.0] - 2026-05-31

### Changed
- **Rebrand** - Jackett removed; project renamed to TPB Porn.
- **P2P fallback** - direct streaming when no debrid key is configured.
- **Debrid** - TorBox, AllDebrid, Premiumize support added incrementally in this line.
- **Configure page** - catalog selection, onlyCached, hide P2P, 1080p catalogs, studio presets, Redis L2 cache.

## [1.2.1] - 2026-06-19

### Added
- **TPDB/StashDB gating** - catalog toggles hidden when server API keys are not configured.

### Changed
- **Hentai attribution** - HentaiMama mentioned in addon description; HentaiStream dropped from description text.

## [1.2.0] - 2026-06-17

### Changed
- **Hentai source** - renamed description to HentaiMama.
