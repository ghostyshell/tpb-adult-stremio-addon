#!/bin/sh
# Regenerate Claude/OpenCode/Cursor shims from docs/agents/skills/*.md
# Run after editing a canonical skill: sh scripts/sync-agent-skills.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sync_shim() {
  slug="$1"
  title="$2"
  quick="$3"
  cursor_desc="$4"
  canon="docs/agents/skills/${slug}.md"

  if [ ! -f "$ROOT/$canon" ]; then
    echo "sync-agent-skills: missing $ROOT/$canon" >&2
    exit 1
  fi

  SHIM_BODY="> **SKILL SHIM** — This file is a pointer only. The canonical source of truth lives at:
> \`$canon\`

# Skill: $title (Shim)

## Quick Reference

$quick

## How to Use

Load the canonical skill for the full workflow:

\`\`\`
$canon
\`\`\`

Global workflow (all repos): \`~/.claude/skills/changelog/SKILL.md\`

---
*This shim exists so that agent-specific directories (\`.claude\`, \`.opencode\`, \`.cursor\`) stay in sync. The canonical file is under \`docs/agents/skills/\`.*
"

  mkdir -p "$ROOT/.claude/skills" "$ROOT/.opencode/skills" "$ROOT/.cursor/skills/$slug"

  printf '%s\n' "$SHIM_BODY" > "$ROOT/.claude/skills/${slug}.md"
  printf '%s\n' "$SHIM_BODY" > "$ROOT/.opencode/skills/${slug}.md"

  {
    printf '%s\n' '---'
    printf '%s\n' "name: $slug"
    printf '%s\n' 'description: >-'
    printf '%s\n' "$cursor_desc"
    printf '%s\n' '---'
    printf '\n%s\n' "$SHIM_BODY"
  } > "$ROOT/.cursor/skills/$slug/SKILL.md"

  echo "synced $slug shims (.claude, .opencode, .cursor) from $canon"
}

sync_shim bump-addon-version "Bump addon version" \
  'Invoke when releasing, committing `src/` changes, or when the user reports a version mismatch. Bump semver in `package.json` (+ lockfile + `docs/index.html` JSON-LD). Pre-commit auto-bumps patch on code changes and **blocks regression** vs git history max.

```bash
sh scripts/bump-addon-version.sh patch    # or 1.9.0 / minor / major
node scripts/addon-version.mjs check
node scripts/addon-version.mjs history-max
sh scripts/install-hooks.sh               # enable pre-commit guard
```' \
  '  Bump tpb-stremio-addon semver in every surface (package.json, lockfile, docs
  JSON-LD), auto-bump before commits when code changes, and block version
  regression vs git history. Use when releasing, bumping version, committing
  src/ changes, or when the user mentions addon version mismatch.'

sync_shim changelog "Changelog" \
  'Before every commit that touches product code, add bullets under `CHANGELOG.md` → `[Unreleased]`, then stage the changelog. Pre-commit fails if code changes land without a changelog diff.

```bash
# edit CHANGELOG.md, then:
git add CHANGELOG.md
sh scripts/install-hooks.sh               # enable pre-commit guard
```' \
  '  Maintain CHANGELOG.md before commits in tpb-stremio-addon. Update [Unreleased]
  for src/ changes, stage CHANGELOG with code. Use when committing, releasing,
  or when pre-commit fails on changelog check.'
