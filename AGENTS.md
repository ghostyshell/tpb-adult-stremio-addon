# tpb-stremio-addon - agent guide

## Project overview

Node.js/TypeScript **Stremio addon** that serves adult 4K/1080p torrent catalogs and resolves streams through per-user debrid keys. It is a thin **Stremio edge**: catalog/meta/manifest requests are proxied to the [torrent-search-go](https://github.com/ghostyshell/torrent-search-go) backend, while stream resolution (12 debrid providers), the Stripchat live HLS proxy, the favorites/profile REST APIs, and the React/Next.js configure UI live in this repo.

- **Live instance:** [tpb-adult-addon.click/configure](https://tpb-adult-addon.click/configure)
- **Docs site:** [ghostyshell.github.io/tpb-adult-stremio-addon](https://ghostyshell.github.io/tpb-adult-stremio-addon/) (served from `docs/` via GitHub Pages)
- **Backend:** [torrent-search-go](https://github.com/ghostyshell/torrent-search-go) (sole API; scraping, catalog warming, cover extraction, TPDB/StashDB enrichment run there)
- **Version source of truth:** `package.json` (`1.9.x`). Pre-commit auto-bumps patch on `src/` changes via `scripts/addon-version.mjs`; the Go backend mirrors the same addon version in its manifest.

| File / dir | Role |
|------------|------|
| `src/server.ts` | HTTP server entry; boots Express + Next.js |
| `src/index.ts` | Stremio addon entry (imported by server) |
| `src/createExpressApp.ts` | Express app: all routes, middleware, security headers, Stripchat HLS + seg proxies, admin flush, health, favorites, profile |
| `src/proxy.ts` | Next.js 16 proxy/middleware: per-request nonced CSP for `/configure` |
| `src/manifest.ts` | Exposes `ADDON_NAME`/`ADDON_VERSION`/`PROVIDERS`; manifest itself is proxied from Go |
| `src/routes/stream.ts` | Stream handler: debrid resolution (12 providers) + P2P fallback + Hentai proxy + Stripchat |
| `src/routes/favorites.ts` | `/api/favorites` (same-origin, Redis-backed) |
| `src/routes/profile.ts` | `/api/profile/*` AES-256-GCM encrypted saved-config slots (Stremio authKey + `SESSION_SECRET`) |
| `src/services/stripchatHls.ts` | Stripchat broadcasts API, master m3u8 fetch, variant parsing, stream entry builder |
| `src/services/stripchatKeys.ts` | Stripchat `pkey` extraction + cache + stale-advert invalidation |
| `src/services/stripchatMouflon.ts` | MOUFLON v2 `pdkey` registry + segment URI decryption + LL-HLS tag stripping |
| `src/services/{realdebrid,torbox,premiumize,easydebrid,debridlink,offcloud,putio,deepbrid,linksnappy,megadebrid,debrider,seedr}.ts` | The 12 debrid provider clients (same interface: `resolveStreams` + `resolveStreamsFromTorrentFile`) |
| `src/services/backend.ts` | Go backend API client (studios KV, auth headers) |
| `src/utils/config.ts` | base64url config encode/decode + `DEFAULT_CONFIG` |
| `src/utils/cache.ts` | Redis-backed cache instances (stream, catalog, meta, section, stripchat) |
| `src/utils/debridProviders.ts` | Provider registry (`DEBRID_PROVIDERS`, `getActiveProvider`, `hasDebridKey`) |
| `src/utils/stremioGo.ts` | Go backend proxy helper + `fetchGoStreams` |
| `src/utils/{redis,mongo,mongoCache}.ts` | Redis + MongoDB client wrappers |
| `src/utils/safeUrl.ts` | SSRF protection (`isSafeUrl`) for operator/user URLs |
| `src/utils/rateLimit.ts` | `globalLimiter` + `stremioLimiter` (express-rate-limit) |
| `src/utils/profileStore.ts` | AES-256-GCM profile slot encryption (MongoDB-backed) |
| `src/lib/installBuilder.ts` | Install URL + multi-instance chunk generator |
| `src/lib/configureProps.ts` | Server-side props for the configure page |
| `src/lib/configureConstants.ts` | Debrid provider labels, catalog defaults, studio presets |
| `src/app/` | Next.js pages (`configure/page.tsx`, `configure/install/page.tsx`, `globals.css`) |
| `src/components/configure/` | React configure UI (`ConfigureApp.tsx`, panels, `ProfileModal`, `useProfile`) |
| `docs/` | GitHub Pages site: `index.html`, `architecture.md`, `code-structure.md`, `configuration.md`, `providers-and-streams.md`, `stripchat.md`, `development.md`, `privacy.html`, `go-migration.md`, `site/` |
| `Dockerfile` | node:24-alpine image; `HEALTHCHECK` hits `/health` |
| `railpack.toml` | Tells the build platform to use the Dockerfile |
| `CHANGELOG.md` | Release history (Keep a Changelog format) |
| `AGENTS.md` | Source of truth for agent instructions (this file) |
| `CLAUDE.md` | Thin pointer so Claude Code loads this file |
| `.cursor/rules/*.mdc` | Cursor rules: `ai-guidelines`, `sync-docs`, `graphify`, `no-em-dashes` |
| `.githooks/{pre-commit,pre-push}` | Pre-commit: changelog + addon-version sync; pre-push: tests + sync-docs reminder |
| `scripts/install-hooks.sh` | One-shot installer pointing git at `.githooks/` |

### Data flow

1. **Catalog/meta/manifest**: Stremio -> `/{config}/catalog|meta|manifest` -> `proxyStremioToGo()` -> Go backend (single source of truth). 502 on backend miss; no local fallback.
2. **Stream (debrid)**: Stremio -> `/{config}/stream/Porn/jstrm:...` -> `decodeItemId` -> `getActiveProvider(cfg)` -> `provider.resolve(apiKey, hash, magnet, userIp)` -> `filesToStreams()`. P2P magnet fallback unless `hideP2P`.
3. **Stream (Hentai)**: `/{config}/stream/Porn/hmm-...` -> `fetchGoStreams()` (Go self-scrapes HentaiMama).
4. **Stream (Stripchat)**: `/{config}/stream/Porn/sc:<username>` -> `stripchatStreams()` returns one entry per variant, each pointing at `/stripchat/hls/<username>/<quality>`.
5. **Media proxy (Stripchat HLS)**: `/stripchat/hls/:username/:quality` -> fetch master with `pkey` -> `decodeMouflonPlaylist(raw, pdkey)` -> `normalizeStripchatM3u8` -> `rewriteM3u8Urls` -> serve `application/vnd.apple.mpegurl` (no CSP). Segments via `/stripchat/seg?url=...` (doppiocdn-only SSRF guard).
6. **Configure/install**: `/configure` (Next.js, nonced CSP) -> POST `/configure/install` -> `buildInstallInstances()` partitions catalogs into <=30-base chunks per provider -> 302 to `/configure/install` with a flash cookie.
7. **Profile/favorites**: `/api/profile/*` (AES-256-GCM slots, Stremio authKey-gated) and `/api/favorites` (same-origin, Redis-backed).

## Commands

```bash
npm install                  # install deps
npm run dev                  # tsx watch src/server.ts (auto-reload)
npm start                    # tsx src/server.ts (production)
npm run build                # next build (configure UI)
npm run typecheck            # tsc --noEmit
npm test                     # vitest run
npm run test:coverage        # vitest run --coverage (gated by pre-push)

# Local dev (needs BACKEND_URL):
BACKEND_URL=https://your-backend.example.com npm run dev
# open http://localhost:7000/configure
```

Docker:

```bash
docker build -t stremio-tpb-porn .
docker run -p 7000:7000 -e BACKEND_URL=https://your-backend.example.com stremio-tpb-porn
```

Install git hooks once after cloning:

```bash
sh scripts/install-hooks.sh
```

## Conventions

- **TypeScript everywhere** under `src/` (`.ts` / `.tsx`); Node 24+ required (see `.nvmrc`).
- The Go backend is the single source of truth for manifest/catalog/meta - the edge has no local fallback. Schema changes need both repos.
- Debrid provider modules share one interface (`resolveStreams` + `resolveStreamsFromTorrentFile`); add new providers via the registry in `src/utils/debridProviders.ts`.
- Per-user config travels in the URL (`base64url` JSON segment). Operator env vars are the floor; per-user config wins. Empty-string per-user fields never clobber env.
- Security: SSRF-validate every operator/user URL via `isSafeUrl`; constant-time admin token compare; same-origin guard on `/api/profile` + `/api/favorites`; per-request nonced CSP on `/configure` HTML; CSP skipped on `/stripchat/*` media proxies and on `/configure` HTML GETs (Next.js stamps its own nonced CSP).
- Stream cache keys thread `scopeKey(apiKey)` so CDN URLs are never shared across users.
- After substantive changes: run `code-reviewer` (and `security-auditor` for input/secret/network surface), add a `CHANGELOG.md` `[Unreleased]` bullet, and bump the version via `sh scripts/bump-addon-version.sh patch` (or let pre-commit auto-bump).

## Keeping docs & instructions in sync

This file (`AGENTS.md`) is the **single source of truth** for agent instructions. `CLAUDE.md` is a thin pointer that makes Claude Code load it; Cursor also reads `.cursor/rules/*.mdc`. When you change instructions here, keep `CLAUDE.md` and the Cursor rules coherent.

- **Before every push** run the `sync-docs` skill (Claude Code / OpenCode) or follow `.cursor/rules/sync-docs.mdc` (Cursor) to audit `README.md`, `CHANGELOG.md`, `docs/`, and this file against the actual code.
- **No em/en dashes** in public-facing copy: `rg '[—–]' README.md CHANGELOG.md docs/` (use `-` or restructure). The `humanizer` skill covers the wider de-AI pass for substantive copy.
- **After code changes** run `graphify update .` (if graphify is wired), run the `code-reviewer` agent (`security-auditor` for input/secret/network surface), and add a `CHANGELOG.md` `[Unreleased]` entry for user-visible changes.
- **Tool-specific notes** table: Claude Code -> `CLAUDE.md` (pointer) -> `AGENTS.md`; OpenCode -> `AGENTS.md`; Cursor -> `AGENTS.md` + `.cursor/rules/*.mdc`.
- `.githooks/pre-push` runs tests + coverage and prints a non-blocking `/sync-docs` reminder; install once with `sh scripts/install-hooks.sh`.

## Vendored skills & agents

- **refactor** (multi-file, vendored from AMOSKILL45/refactor-architecture) - `/refactor` skill, 8 phases. Canonical: `docs/agents/skills/refactor/`; live copies `.claude/skills/refactor/` + `.opencode/skills/refactor/` (keep all three identical). Exempt from `scripts/sync-agent-skills.sh` (it only shims single-file skills).
- **code-validator** agent - `docs/agents/code-validator.md` + `.claude/agents/code-validator.md`. Run after any refactor commit/move to gate on `typecheck` + tests + static hazard review.

## Graphify

This repo includes a graphify knowledge graph at `graphify-out/` (gitignored; regenerate locally).

```bash
graphify .                  # initial build
graphify update .           # after code changes (AST-only, no API cost)
graphify query "how does stripchat decryption work?"
```

Agents: see `.cursor/rules/graphify.mdc` - run graphify before exploring the codebase.

## Sliplane (live deployment)

The addon runs on Sliplane (germany-fz5xja region). Use the `sliplane-ssh` agent (`.opencode/agents/sliplane-ssh.md`, gitignored - carries the service handle) to SSH into the live container for log/process/env inspection. Changes inside the container do NOT persist across redeploys; trigger a redeploy from the Sliplane dashboard.
