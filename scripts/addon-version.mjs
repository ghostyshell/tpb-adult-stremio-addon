#!/usr/bin/env node
/**
 * Single source of truth for addon semver: package.json (+ lockfile via npm version).
 * Also syncs docs/index.html JSON-LD softwareVersion when present.
 *
 * ponytail: no semver npm dep; numeric x.y.z compare only.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'package.json');
const DOCS_INDEX = join(ROOT, 'docs', 'index.html');

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v).trim());
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [+m[1], +m[2], +m[3]];
}

function format([a, b, c]) {
  return `${a}.${b}.${c}`;
}

export function cmp(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function readVersion() {
  return JSON.parse(readFileSync(PKG, 'utf8')).version;
}

function bump(kind, current) {
  const p = parse(current);
  if (kind === 'patch') return format([p[0], p[1], p[2] + 1]);
  if (kind === 'minor') return format([p[0], p[1] + 1, 0]);
  if (kind === 'major') return format([p[0] + 1, 0, 0]);
  throw new Error(`Unknown bump kind: ${kind}`);
}

function npmVersion(target) {
  execSync(`npm version ${target} --no-git-tag-version --allow-same-version`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function syncDocsIndex(version) {
  if (!existsSync(DOCS_INDEX)) return false;
  let html = readFileSync(DOCS_INDEX, 'utf8');
  const re = /("softwareVersion"\s*:\s*")[^"]*(")/;
  if (re.test(html)) {
    html = html.replace(re, `$1${version}$2`);
  } else {
    // Insert after "name" in SoftwareApplication JSON-LD block.
    const anchor = /("name"\s*:\s*"TPB 4K Porn",)/;
    if (!anchor.test(html)) {
      throw new Error('docs/index.html: cannot find JSON-LD name anchor for softwareVersion');
    }
    html = html.replace(anchor, `$1\n    "softwareVersion": "${version}",`);
  }
  writeFileSync(DOCS_INDEX, html);
  return true;
}

function gitHistoryMax() {
  let out;
  try {
    out = execSync('git log --all --format=%H -- package.json', { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return readVersion();
  }
  const hashes = out.trim().split('\n').filter(Boolean);
  let max = '0.0.0';
  for (const h of hashes) {
    try {
      const raw = execSync(`git show ${h}:package.json`, { cwd: ROOT, encoding: 'utf8' });
      const v = JSON.parse(raw).version;
      if (cmp(v, max) > 0) max = v;
    } catch {
      /* skip unreadable commits */
    }
  }
  return max;
}

function lockMatchesPackage() {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const pkg = readVersion();
  return lock.version === pkg && lock.packages?.['']?.version === pkg;
}

/** Staged paths that should trigger an automatic patch bump when version is unchanged. */
const CODE_PREFIXES = ['src/', 'public/', 'Dockerfile', 'next.config.js', 'tsconfig.json'];

function stagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function headVersion() {
  try {
    const raw = execSync('git show HEAD:package.json', { cwd: ROOT, encoding: 'utf8' });
    return JSON.parse(raw).version;
  } catch {
    return null;
  }
}

function needsAutoBump(staged) {
  const touchesCode = staged.some((f) =>
    CODE_PREFIXES.some((p) => f === p || f.startsWith(p)),
  );
  if (!touchesCode) return false;
  const versionStaged = staged.some((f) => f === 'package.json' || f === 'package-lock.json');
  if (versionStaged) return false;
  const cur = readVersion();
  const head = headVersion();
  return head === null || cur === head;
}

function stageVersionFiles(extra = []) {
  const files = ['package.json', 'package-lock.json', ...extra];
  execSync(`git add ${files.map((f) => JSON.stringify(f)).join(' ')}`, { cwd: ROOT });
}

export function setVersion(target) {
  npmVersion(target);
  const v = readVersion();
  const docs = syncDocsIndex(v);
  return { version: v, docsUpdated: docs };
}

export function checkVersion({ label = 'addon-version' } = {}) {
  const cur = readVersion();
  const max = gitHistoryMax();
  const errors = [];

  if (!lockMatchesPackage()) {
    errors.push(`${label}: package-lock.json version out of sync with package.json (${cur})`);
  }
  if (cmp(cur, max) < 0) {
    errors.push(
      `${label}: version regression — package.json is ${cur} but git history max is ${max}. ` +
        `Run: node scripts/addon-version.mjs set ${max} (or higher).`,
    );
  }

  if (existsSync(DOCS_INDEX)) {
    const html = readFileSync(DOCS_INDEX, 'utf8');
    const m = /"softwareVersion"\s*:\s*"([^"]+)"/.exec(html);
    if (m && m[1] !== cur) {
      errors.push(
        `${label}: docs/index.html softwareVersion is ${m[1]} but package.json is ${cur}. ` +
          'Run: node scripts/addon-version.mjs sync-docs',
      );
    }
  }

  return { ok: errors.length === 0, version: cur, historyMax: max, errors };
}

export function preCommit() {
  const staged = stagedFiles();
  if (needsAutoBump(staged)) {
    const next = bump('patch', readVersion());
    console.log(`[pre-commit] code changed without version bump; auto-bumping patch → ${next}`);
    setVersion(next);
    stageVersionFiles(existsSync(DOCS_INDEX) ? ['docs/index.html'] : []);
  } else if (staged.some((f) => f === 'package.json')) {
    syncDocsIndex(readVersion());
    if (existsSync(DOCS_INDEX) && staged.includes('docs/index.html') === false) {
      const htmlChanged = execSync('git diff -- docs/index.html', { cwd: ROOT, encoding: 'utf8' });
      if (htmlChanged.trim()) stageVersionFiles(['docs/index.html']);
    }
  }

  const result = checkVersion({ label: 'pre-commit' });
  if (!result.ok) {
    for (const e of result.errors) console.error(e);
    process.exit(1);
  }
  console.log(`[pre-commit] addon version OK: ${result.version} (history max ${result.historyMax})`);
}

function usage() {
  console.log(`Usage:
  node scripts/addon-version.mjs get
  node scripts/addon-version.mjs history-max
  node scripts/addon-version.mjs set <x.y.z>
  node scripts/addon-version.mjs bump patch|minor|major
  node scripts/addon-version.mjs sync-docs
  node scripts/addon-version.mjs check
  node scripts/addon-version.mjs pre-commit`);
}

const [,, cmd, arg] = process.argv;

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('addon-version.mjs')) {
  switch (cmd) {
    case 'get':
      console.log(readVersion());
      break;
    case 'history-max':
      console.log(gitHistoryMax());
      break;
    case 'set':
      if (!arg) { usage(); process.exit(1); }
      setVersion(arg);
      console.log(readVersion());
      break;
    case 'bump':
      if (!['patch', 'minor', 'major'].includes(arg)) { usage(); process.exit(1); }
      setVersion(bump(arg, readVersion()));
      console.log(readVersion());
      break;
    case 'sync-docs':
      syncDocsIndex(readVersion());
      console.log(`synced docs/index.html → ${readVersion()}`);
      break;
    case 'check': {
      const r = checkVersion();
      if (!r.ok) {
        for (const e of r.errors) console.error(e);
        process.exit(1);
      }
      console.log(`OK ${r.version} (history max ${r.historyMax})`);
      break;
    }
    case 'pre-commit':
      preCommit();
      break;
    default:
      usage();
      process.exit(cmd ? 1 : 0);
  }
}

// ponytail: self-check semver compare
if (process.env.ADDON_VERSION_SELF_CHECK === '1') {
  if (cmp('1.9.0', '1.5.3') <= 0 || cmp('1.9.0', '1.9.0') !== 0) {
    throw new Error('addon-version self-check failed');
  }
}
