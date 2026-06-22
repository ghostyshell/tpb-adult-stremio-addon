# Skill: Changelog (tpb-stremio-addon)

> Global workflow: `~/.claude/skills/changelog/SKILL.md`

## Repo paths

| Item | Path |
|------|------|
| Changelog | `CHANGELOG.md` (repo root) |
| Version source | `package.json` `"version"` |
| Pre-commit | `.githooks/pre-commit` runs `scripts/changelog-check.sh` |
| Version bump | `scripts/bump-addon-version.sh` / `node scripts/addon-version.mjs` |

## Before every commit

1. Update `CHANGELOG.md` → `[Unreleased]` for staged `src/`, `public/`, `Dockerfile`, or Next/TS config changes.
2. Run version bump (or let pre-commit auto-bump patch).
3. Stage `CHANGELOG.md` with code + version files.

Pre-commit **fails** if product code is staged without a staged `CHANGELOG.md` diff.

## Release

When the version bump lands in `package.json`:

1. Move `[Unreleased]` bullets into `## [x.y.z] - YYYY-MM-DD` matching `package.json`.
2. Reset `[Unreleased]` (empty).
3. Bump Go backend `addonVersion` in `torrent-search-go` and add matching section there.

## Shim sync

After editing this file:

```bash
sh scripts/sync-agent-skills.sh
```
