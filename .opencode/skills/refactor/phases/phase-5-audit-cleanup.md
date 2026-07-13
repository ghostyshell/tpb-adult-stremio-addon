# Phase 5 — Cleanup, Audit & Final Validation

**Goal:** Remove scaffolding (re-exports), update docs, run the full audit, validate everything.

**Risk:** None — removing dead code and validating.

## Skip if

You cannot skip Phase 5. Even if you stopped at an earlier phase, run the audit sections that apply — they give you an honest picture of what the refactor achieved.

## 5.1 — Strip the Monolith

**Only after Phase 4 migration count is 0.**

Remove all re-exports from the monolith file. It should now contain only the client / connection setup:

```typescript
// lib/supabase.ts (final form — ~20 lines)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
);
```

Verify no one still imports **functions** from it:

```bash
grep -rn "from '@/lib/supabase'" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v "{ supabase }\|{ client }" \
  | grep -v node_modules

# Must return 0 results.
```

## 5.2 — Update Documentation

Update project docs (README, CLAUDE.md, CONTRIBUTING.md) to reflect:

- New `lib/api/` structure and what each module owns.
- `hooks/queries/` conventions (query hooks, mutation hooks).
- `hooks/realtime/` conventions (subscription hooks).
- Cache-key registry usage.
- Mutation pattern (invalidation, optimistic updates).

Include a "where do I put this?" decision table — future contributors will ask.

## 5.3 — Run the Full Audit

Run each section and compile the report. **All audit scripts live in [../references/audits.md](../references/audits.md) — load that file, run the scripts, and bring the results back here for scoring.**

Six audits, each graded A–D:

1. **Type Safety** — `as any` count, broken down by justified vs fixable.
2. **Dead Code** — re-exports that shouldn't exist, unused exports.
3. **Import Hygiene** — monolith imports remaining, dynamic imports, cross-domain coupling.
4. **Test Coverage** — hooks / utilities without tests.
5. **Architecture Conformance** — functions per module, inline subs remaining, god files remaining.
6. **Duplication** — duplicate status / format / helper definitions.

### Compile Audit Report

```markdown
# Refactor Audit Report

**Date:** YYYY-MM-DD
**Branch:** refactor/architecture

## Scorecard

| Audit | Score | Details |
|-------|-------|---------|
| Type Safety | _ | X total, Y fixable |
| Dead Code | _ | X unused exports |
| Import Hygiene | _ | X monolith imports remaining |
| Test Coverage | _ | X tests, Y% hooks covered |
| Architecture | _ | X god files, Y inline subs |
| Duplication | _ | X duplicates |

**Overall Grade:** [A–D based on lowest score]

## Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Monolith lines |  |  |  |
| Largest file |  |  |  |
| `as any` count |  |  |  |
| Test count |  |  |  |
| Domain modules | 0 |  |  |

## Action Items

### Must Fix (Before Merge)
- [ ] ...

### Should Fix (Next Sprint)
- [ ] ...
```

**If overall grade is C or D on any audit, fix those issues before proceeding to 5.4.**

## 5.4 — Final Regression

Run the **code-validator** agent one final time, then:

```bash
# Type check
npx tsc --noEmit

# Tests
npm test

# Migration completeness (all must be 0)
grep -rn "from '@/lib/supabase'" app/ components/ hooks/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "{ supabase }\|{ client }" \
  | wc -l

grep -rn "\.channel(" app/ --include="*.tsx" | wc -l
```

Boot the app on device / simulator / production build. Walk through the E2E flows defined in Phase 0ter. Every one must still pass.

## 5.5 — Tag & Ship

```bash
git tag checkpoint/phase-5-complete
git tag post-refactor
git push origin refactor/architecture --tags
```

Open the PR (or series of PRs) from `refactor/architecture` into `main`. Paste the audit report into the description.

## Final Scorecard

Present to the user:

| Metric | Before | After |
|--------|--------|-------|
| Monolith file | ??? lines | ~20 lines |
| Largest screen | ??? lines | ??? lines |
| `as any` count | ??? | ??? |
| Test count | ??? | ??? |
| Domain modules | 0 | ??? |
| Realtime hooks | 0 | ??? |
| Query hooks | 0 | ??? |
| Audit grade | N/A | ??? |

This is the report that proves the refactor was worth it — keep it. It becomes the reference for the next refactor in the same codebase, and the argument for ones in other codebases.
