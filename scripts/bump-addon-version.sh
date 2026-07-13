#!/bin/sh
# Bump addon version everywhere (package.json, lockfile, docs/index.html).
# Usage: sh scripts/bump-addon-version.sh [x.y.z | patch | minor | major]
set -e
cd "$(dirname "$0")/.." || exit 1
target="${1:-patch}"
case "$target" in
  patch|minor|major) node scripts/addon-version.mjs bump "$target" ;;
  *) node scripts/addon-version.mjs set "$target" ;;
esac
