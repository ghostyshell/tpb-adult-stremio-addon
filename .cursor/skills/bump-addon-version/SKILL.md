---
name: bump-addon-version
description: >-
  Bump tpb-stremio-addon semver in every surface (package.json, lockfile, docs
  JSON-LD), auto-bump before commits when code changes, and block version
  regression vs git history. Use when releasing, bumping version, committing
  src/ changes, or when the user mentions addon version mismatch.
---

> **SKILL SHIM** — This file is a pointer only. The canonical source of truth lives at:
> `docs/agents/skills/bump-addon-version.md`

# Skill: Bump addon version (Shim)

## Quick Reference

Invoke when releasing, committing `src/` changes, or when the user reports a version mismatch. Bump semver in `package.json` (+ lockfile + `docs/index.html` JSON-LD). Pre-commit auto-bumps patch on code changes and **blocks regression** vs git history max.

```bash
sh scripts/bump-addon-version.sh patch    # or 1.9.0 / minor / major
node scripts/addon-version.mjs check
node scripts/addon-version.mjs history-max
sh scripts/install-hooks.sh               # enable pre-commit guard
```

## How to Use

Load the canonical skill for the full workflow:

```
docs/agents/skills/bump-addon-version.md
```

Global workflow (all repos): `~/.claude/skills/changelog/SKILL.md`

---
*This shim exists so that agent-specific directories (`.claude`, `.opencode`, `.cursor`) stay in sync. The canonical file is under `docs/agents/skills/`.*

