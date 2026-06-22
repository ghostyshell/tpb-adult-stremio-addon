# Changelog

All notable changes to **tpb-stremio-addon** (Stremio edge / configure UI) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and tracks `package.json`.

---

## [Unreleased]

### Added
- **Stripchat HLS proxy** - HLS stream proxy with pkey auto-extraction, CDN host allowlist, advert-placeholder detection and auto-refresh. Requires Playwright for extraction.

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
