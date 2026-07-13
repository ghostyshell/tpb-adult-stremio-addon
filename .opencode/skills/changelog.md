> **SKILL SHIM** — This file is a pointer only. The canonical source of truth lives at:
> `docs/agents/skills/changelog.md`

# Skill: Changelog (Shim)

## Quick Reference

Before every commit that touches product code, add bullets under `CHANGELOG.md` → `[Unreleased]`, then stage the changelog. Pre-commit fails if code changes land without a changelog diff.

```bash
# edit CHANGELOG.md, then:
git add CHANGELOG.md
sh scripts/install-hooks.sh               # enable pre-commit guard
```

## How to Use

Load the canonical skill for the full workflow:

```
docs/agents/skills/changelog.md
```

Global workflow (all repos): `~/.claude/skills/changelog/SKILL.md`

---
*This shim exists so that agent-specific directories (`.claude`, `.opencode`, `.cursor`) stay in sync. The canonical file is under `docs/agents/skills/`.*

