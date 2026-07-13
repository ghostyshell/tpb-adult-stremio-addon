---
name: refactor
description: Use when refactoring a large TypeScript/React codebase — god files (>500 lines), manual useState+useEffect+fetch patterns, scattered realtime subscriptions, or a monolithic API file — where behavior must be preserved while structure improves.
---

# Architecture Refactor Skill

A battle-tested methodology for safely refactoring large TypeScript/React codebases without regressions. Structure-preserving migration: **same behavior, better organization**, one checkpoint at a time.

**Announce at start:** "I'm using the refactor skill to systematically restructure this codebase."

## Philosophy

> Write tests BEFORE refactoring and keep them green. One chunk at a time. Don't change behavior — only clean up.

This is not a rewrite. Every phase has a rollback. Every commit has a validation gate. Every checkpoint is a known-good state you can stop at.

## When to Use This Skill

Use this skill when the codebase exhibits **at least two** of these symptoms:

- A file over 1500 lines that owns multiple domains (auth + data + UI mixed together).
- `as any` casts are so common that `tsc --strict` is effectively bypassed.
- Data fetching is duplicated across screens with manual `useState` + `useEffect` + `fetch`.
- Realtime subscriptions (`supabase.channel`, WebSocket handlers) live inline in screens.
- The "API layer" is one giant file everyone imports from.
- Role-based access control is enforced inconsistently or not at all.
- There are zero or near-zero tests.

### Skip this skill if

- The codebase is under ~10k LOC — manual refactoring is faster than this methodology.
- You're doing a rewrite, not a refactor — this skill preserves behavior, it does not rethink it.
- The monolith is in a non-TS/JS language — the re-export pattern (Phase 3) depends on ESM.
- You need a feature shipped this week — this is PR-count-heavy. Budget in weeks, not days.

## The Phased Plan

The skill is organized into **progressive phases**. Load only the phase you're currently executing. Each phase file is self-contained: goal, steps, validation gate, checkpoint, rollback notes, and explicit "Skip if" conditions.

| Phase | File | Goal | Risk | Typical PRs |
|-------|------|------|------|-------------|
| **Pre-Flight** | this file | Analyze codebase, score problems, map the monolith | None | 0 |
| **Phase 0** | [phases/phase-0-prerequisites.md](phases/phase-0-prerequisites.md) | Git cleanup, install state mgmt + test framework, create query key registry | None | 3–5 |
| **Phase 0bis** | [phases/phase-0bis-boundaries.md](phases/phase-0bis-boundaries.md) | Role guards, deep link hardening, navigation boundaries | Low | 2–5 |
| **Phase 0ter** | [phases/phase-0ter-tests.md](phases/phase-0ter-tests.md) | Test foundation — unit tests, mocks, E2E definitions | None | 5–10 |
| **Phase 1** | [phases/phase-1-state-management.md](phases/phase-1-state-management.md) | State-mgmt pilot + realtime hook extraction + call-site migration | Isolated | 8–15 |
| **Phase 2** | [phases/phase-2-break-god-files.md](phases/phase-2-break-god-files.md) | Extract types, kill `as any`, pull hooks + components from god files | Moderate | 10–25 |
| **Phase 3** | [phases/phase-3-split-monolith.md](phases/phase-3-split-monolith.md) | Split monolith into domain API modules with re-exports | Low | 3–8 |
| **Phase 4** | [phases/phase-4-migrate-imports.md](phases/phase-4-migrate-imports.md) | Migrate consumers from monolith to domain modules (batched) | Low | 8–20 |
| **Phase 5** | [phases/phase-5-audit-cleanup.md](phases/phase-5-audit-cleanup.md) | Strip re-exports, full audit, final regression | None | 2–4 |

**Numbers are from one reference project (87 PRs total, 2.5k-line monolith → 11 modules). Your numbers will differ.**

### Reference Material (load on demand)

- [references/audits.md](references/audits.md) — all audit scripts (type safety, dead code, imports, tests, architecture, duplication).
- [references/pitfalls.md](references/pitfalls.md) — dynamic imports, circular deps, re-export timing, test mock paths, Unicode regex, realtime cleanup, cache key typos.
- [references/team-coordination.md](references/team-coordination.md) — running the refactor without blocking feature teams (branch strategy, merge cadence, conflict triage).
- [references/db-migrations.md](references/db-migrations.md) — when schema changes intersect the refactor.

## Agents & Validation

This skill uses the **code-validator** agent. Invoke it:

- **After every commit** — to catch type errors, lint issues, and regressions.
- **After every checkpoint** — as a gate before tagging.
- **After any file move or rename** — import breakage is the #1 risk during refactoring.

The code-validator auto-detects the stack (React Native, Next.js, Vite, plain TS), runs the project's type check + lint + tests, and does refactor-specific static review (orphaned imports, dynamic imports, circular deps). If it reports **FAIL**, fix before proceeding. Never skip it.

---

## Pre-Flight: Codebase Analysis

Before touching any phase, do the analysis below and present the scorecard to the user.

### Step 1: Identify the Problems

```bash
# God files (>500 lines)
find . \( -name "*.ts" -o -name "*.tsx" \) -not -path '*/node_modules/*' -print0 \
  | xargs -0 wc -l | sort -rn | head -20

# Unsafe type casts
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | wc -l

# Test coverage (file-level heuristic)
find . \( -name "*.test.*" -o -name "*.spec.*" \) -not -path '*/node_modules/*' | wc -l

# Monolith candidates: files with >20 exported symbols
find . \( -name "*.ts" -o -name "*.tsx" \) -not -path '*/node_modules/*' -not -name '*.d.ts' -print0 \
  | while IFS= read -r -d '' f; do
      count=$(grep -c "^export " "$f" 2>/dev/null)
      [ "$count" -gt 20 ] && echo "$count exports: $f"
    done

# Manual fetch/cache patterns
grep -rn "useState.*fetch\|useEffect.*fetch\|cacheRef\|CACHE_TTL" \
  --include="*.tsx" . | grep -v node_modules | wc -l

# Inline realtime subscriptions
grep -rn "\.channel(\|\.on('postgres_changes'\|new WebSocket(" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l
```

### Step 2: Score the Codebase

Rate each dimension 1–5 (5 = worst):

| Dimension | Metric | Score |
|-----------|--------|-------|
| God files | largest file lines ÷ 500 | _ |
| Type safety | `as any` count ÷ 20 | _ |
| Duplication | duplicate constant/helper definitions | _ |
| Test coverage | 5 − (test files ÷ source files × 5) | _ |
| Coupling | files importing from the monolith | _ |
| State chaos | manual fetch/cache patterns | _ |

Present this table to the user with the raw numbers.

### Step 3: Map the Monolith

For the largest file(s), catalog every export by domain:

```
lib/supabase.ts (2461 lines, 79 functions)
├── Auth/Profile:   signUp, signIn, signOut, getCurrentProfile... (15 fns)
├── Booking:        createRequest, getRequests, acceptRequest...  (7 fns)
├── Jobs:           getNearbyJobs, completeJob, updateStatus...   (11 fns)
├── Messaging:      sendMessage, getMessages, markRead...         (3 fns)
├── Payments:       getEarnings, getReviews...                    (3 fns)
└── ...
```

This map becomes the blueprint for Phase 3 (domain module split).

### Step 4: Recommend a Phase Order

Default order is 0 → 0bis → 0ter → 1 → 2 → 3 → 4 → 5, but adjust using the decision tree:

```
Scorecard ready
  │
  ▼
Already has role guards everywhere? ── yes ──▶ Skip Phase 0bis
  │ no
  ▼
Has ≥50 tests covering critical flows? ── yes ──▶ Skip Phase 0ter (write tests per-feature in 1/2 instead)
  │ no
  ▼
Uses manual useState+useEffect+fetch? ── no (already React Query/SWR) ──▶ Skip Phase 1 fetch pilot
  │ yes
  ▼
Has god files OR monolith file? ── no ──▶ Stop (refactor is done)
  │ yes
  ▼
Run Phases 2 → 5
```

### Step 5: Present the Plan

Show the user:

1. The scorecard (numbers + grades).
2. The monolith map.
3. Estimated PR count per phase (adjust reference numbers based on codebase size).
4. The recommended phase order based on the decision tree.

Get **explicit approval** before proceeding to Phase 0.

---

## Safety Infrastructure

Set up BEFORE writing any refactoring code. Non-negotiable.

### 4-Level Rollback

| Level | Granularity | Tool | When |
|-------|-------------|------|------|
| N1 — Commit | Few lines | `git revert <sha>` | Obvious error in 1 commit |
| N2 — Sub-branch | 1 sub-task | Close PR without merge | Entire sub-task is broken |
| N3 — Phase | 1 phase | `git reset --hard checkpoint/phase-N` | Phase introduced subtle bugs |
| N4 — Everything | Full refactor | `git checkout pre-refactor-stable` | Catastrophe, start over |

### Rules (Enforce at Every Step)

- **1 PR = 1 sub-task.** Never mega-PRs.
- **Run code-validator agent** before every commit.
- **`npx tsc --noEmit` must pass** before every commit.
- **Tests must pass** before every commit (after test infrastructure exists).
- **App must boot** after every phase checkpoint.
- **Re-exports** keep existing imports working during migration (Phases 3–4 only).
- **Never remove an import** without grep verification.
- **Never modify business logic** during a move operation.
- **Never skip a checkpoint** — each is a known-good state to roll back to.

### Branching Strategy

```
main (or current working branch)
  └── tag: pre-refactor-stable
       └── refactor/architecture
            ├── Phase 0 commits (or sub-branches per PR)
            ├── Phase 1 commits
            ├── ...
            └── Phase 5 commits → tag: post-refactor
```

For teams of 2+ developers, see [references/team-coordination.md](references/team-coordination.md) — the branching strategy changes when feature work continues in parallel.

### Checkpoint Procedure

Before tagging `checkpoint/phase-N-complete`:

1. **Run code-validator agent** — must report PASS.
2. `npx tsc --noEmit` — zero errors.
3. Run project tests — all green (after Phase 0ter exists).
4. App boots on device / simulator / dev server.
5. Phase-specific flow test (documented per phase).
6. Grep validation for migration completeness (documented per phase).

Only then tag and move on.

---

## Escape Hatches

- **If a phase is blocked for >2 days**, stop. Run code-validator, commit what works, tag a checkpoint, and unblock with the user before continuing. Refactors that stall become rewrites.
- **If tests start failing intermittently after a phase**, do not proceed. That's a regression leak — investigate before the signal dies.
- **If PR conflicts with main exceed 30% of the diff**, the branch has drifted too far. Rebase on main at the next checkpoint, or split the remaining work into a fresh branch.

---

## Common Pitfalls (summary)

Full details in [references/pitfalls.md](references/pitfalls.md). One-line reminders:

1. **Dynamic imports** — `await import('…')` is invisible to static grep.
2. **Circular dependencies** — splitting a monolith can create them; use a shared helper file.
3. **Re-export removal timing** — never before Phase 5, even if you think migration is complete.
4. **Test mock paths** — moving a function means updating every `jest.mock(…)` that targets it.
5. **Realtime cleanup** — forgetting `removeChannel` / `unsubscribe` causes duplicate handlers.
6. **Cache key typos** — always use the registry, never hardcode strings.
7. **Unicode in string helpers** — `\w` breaks on accented characters; use `\p{L}` with the `u` flag.
8. **React `act()` warnings** — set `IS_REACT_ACT_ENVIRONMENT = true` in test setup.
