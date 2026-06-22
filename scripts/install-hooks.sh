#!/bin/sh
# Point git at the repo's version-controlled .githooks/ dir.
# Installs pre-commit (addon version sync + regression guard) and pre-push (sync-docs reminder).
# Run once after cloning: sh scripts/install-hooks.sh
cd "$(dirname "$0")/.." || exit 1
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null
chmod +x scripts/changelog-check.sh 2>/dev/null
echo "hooks installed: core.hooksPath = .githooks"
echo "  pre-commit → changelog-check + node scripts/addon-version.mjs (auto patch bump + history regression check)"
