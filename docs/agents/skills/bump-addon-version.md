# Skill: Bump addon version

## Description

Keep `tpb-stremio-addon` semver in sync across every surface, auto-bump before commits when product code changes, and **block version regression** vs git history (e.g. the `1.9.0` → `1.2.1` → `1.5.x` renumber).

## Trigger

Invoke when:

- Releasing or tagging a version
- Committing changes under `src/`, `public/`, `Dockerfile`, or Next/TS config
- The user reports a version mismatch (configure UI, `/health`, Stremio manifest)
- Pre-commit fails on version regression

## Source of truth

`package.json` `"version"` is the only hand-edited semver. Runtime reads it via `src/manifest.ts` (`ADDON_VERSION`). Do not hardcode version strings in TS/JS.

## Surfaces synced by tooling

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `package-lock.json` | root + `packages[""].version` (via `npm version`) |
| `docs/index.html` | JSON-LD `"softwareVersion"` |
| Go backend manifest | `"version"` - see "Backend manifest" below |

Configure UI, `/health`, and the Stremio `manifest.json` pick up `package.json` automatically.

## Backend manifest

Stremio installs the addon through the Node edge (`/:config/manifest.json`), which proxies the manifest from the Go backend (`torrent-search-go`). The Go backend hardcodes a baseline version in `internal/stremio/manifest.go` (`addonVersion` const, env-overridable via `ADDON_VERSION`). To keep Stremio from showing a stale backend version, the Node edge stamps the live `ADDON_VERSION` onto the proxied manifest in `src/utils/stremioGo.ts` (`proxyStremioToGo`, `subpath === '/manifest.json'`). A `package.json` bump therefore propagates to Stremio on the next edge deploy with no backend change required.

The Go `addonVersion` const is a fallback for direct-backend hits only. When bumping the addon here, also bump the Go const (and/or set `ADDON_VERSION` on the backend deploy) so direct hits and the fallback path stay aligned. The const is not the source of truth; `package.json` is.

## Commands

```bash
# Explicit target (restores after a regression, e.g. 1.5.3 → 1.9.0)
sh scripts/bump-addon-version.sh 1.9.0

# Semver bump
sh scripts/bump-addon-version.sh patch   # 1.9.0 → 1.9.1
sh scripts/bump-addon-version.sh minor   # 1.9.0 → 1.10.0
sh scripts/bump-addon-version.sh major   # 1.9.0 → 2.0.0

# Validate only (no regression vs git history, lockfile + docs in sync)
node scripts/addon-version.mjs check

# Show highest version ever committed on any branch
node scripts/addon-version.mjs history-max
```

## Before every commit

The `.githooks/pre-commit` hook (install with `sh scripts/install-hooks.sh`):

1. **Auto-bump patch** when staged changes touch `src/`, `public/`, `Dockerfile`, or Next/TS config but `package.json` was not bumped.
2. **Sync** `docs/index.html` when `package.json` version changes.
3. **Block regression**: fail if current version `<` max version ever seen in `git log --all -- package.json`.

Known regression to avoid: `1.9.0` was shipped in `4de02ec`, then reset to `1.2.1` and renumbered through `1.5.x`. Never drop below `history-max` without an explicit user decision.

## Agent workflow

When committing product code in this repo:

1. Run `node scripts/addon-version.mjs history-max` if choosing a version manually.
2. Prefer `sh scripts/bump-addon-version.sh patch` (or explicit set) **before** `git commit` when you changed `src/`.
3. Stage version files with the code change.
4. If pre-commit fails on regression, bump to `history-max` or higher, never lower.

## Release checklist

- [ ] `node scripts/addon-version.mjs check` passes
- [ ] Go backend `addonVersion` const (and/or `ADDON_VERSION` deploy env) matches
- [ ] `/health` returns the new version after deploy
- [ ] Reinstall addon in Stremio (manifest version is baked into install URL config)
