#!/bin/sh
# Pre-commit: require CHANGELOG.md update when product code changes.
# Install: sh scripts/install-hooks.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Repo-specific code prefixes (ponytail: one list per repo, no shared lib).
case "$(basename "$ROOT")" in
  tpb-stremio-addon)
    PREFIXES='src/ public/ Dockerfile next.config.js tsconfig.json'
    ;;
  torrent-search-go)
    PREFIXES='internal/ cmd/ main.go'
    ;;
  *)
    PREFIXES='src/ internal/ cmd/ main.go public/'
    ;;
esac

staged=$(git diff --cached --name-only)
[ -z "$staged" ] && exit 0

touches_code=false
for f in $staged; do
  for p in $PREFIXES; do
    case "$f" in
      $p|$p*) touches_code=true; break ;;
    esac
  done
  $touches_code && break
done

$touches_code || exit 0

if printf '%s\n' "$staged" | grep -qx 'CHANGELOG.md'; then
  if git diff --cached --quiet -- CHANGELOG.md 2>/dev/null; then
    echo "[pre-commit] CHANGELOG.md is staged but has no content changes." >&2
    echo "Add bullets under [Unreleased] for this commit (see docs/agents/skills/changelog.md)." >&2
    exit 1
  fi
  exit 0
fi

echo "[pre-commit] Product code changed without CHANGELOG.md update." >&2
echo "Edit CHANGELOG.md [Unreleased], then: git add CHANGELOG.md" >&2
echo "Skill: docs/agents/skills/changelog.md" >&2
exit 1
