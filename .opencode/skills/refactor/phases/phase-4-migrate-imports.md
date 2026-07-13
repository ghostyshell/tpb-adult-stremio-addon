# Phase 4 — Migrate All Imports

**Goal:** Update every consumer to import from domain modules instead of the monolith. Batch by domain, 1–5 files per PR.

**Risk:** Low — mechanical find-and-replace with verification.

## Skip if

- You skipped Phase 3 (no monolith existed).

Otherwise, this phase is mandatory. Leaving half the consumers on the old path is worse than not splitting at all.

## Strategy

```bash
# Find all consumers of the monolith
grep -rn "from '@/lib/supabase'" app/ components/ hooks/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules
```

For each file:

1. Change `import { fn } from '@/lib/supabase'` → `import { fn } from '@/lib/api/<domain>Api'`.
2. If the file uses functions from multiple domains, use the barrel: `import { fn1, fn2 } from '@/lib/api'`.
3. Run the **code-validator** agent.
4. Commit.

**Batch by domain** — migrate all auth imports in one PR, all items imports in another, etc. Per-domain batches minimize merge conflicts when multiple people are working.

## Watch for Dynamic Imports

Static grep misses dynamic imports — find them separately:

```bash
grep -rn "import('@/lib/supabase')\|require('@/lib/supabase')" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

These cause **runtime** errors if you remove the re-exports in Phase 5 without migrating them first. Treat them as blockers.

## Watch for Test Mocks

Test files often hardcode the monolith path:

```bash
grep -rn "jest.mock('@/lib/supabase')\|jest.mock(\"@/lib/supabase\")" \
  __tests__/ --include="*.ts" --include="*.tsx" 2>/dev/null
```

Update each mock to target the new domain path. Example:

```typescript
// Before
jest.mock('@/lib/supabase', () => ({ getItems: jest.fn() }));

// After
jest.mock('@/lib/api/itemsApi', () => ({ getItems: jest.fn() }));
```

## Progress Tracking

After each batch:

```bash
# Remaining consumers of the monolith (goal: reaches 0)
grep -rn "from '@/lib/supabase'" app/ components/ hooks/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
```

Keep a running count. When it hits 0 (excluding the client import itself), you're ready for the Phase 4 checkpoint.

## Checkpoint: `checkpoint/phase-4-complete`

This grep MUST return 0 results (except the client-setup import itself):

```bash
grep -rn "from '@/lib/supabase'" app/ components/ hooks/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "{ supabase }\|{ client }" \
  | grep -v node_modules
```

Also zero:

```bash
grep -rn "import('@/lib/supabase')" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l
```

And:

- `npx tsc --noEmit` clean.
- Tests green.
- App boots and main flows work.

Tag:

```bash
git tag checkpoint/phase-4-complete
```

## Rollback

Per-batch:

```bash
git revert <batch-sha>
```

Full phase:

```bash
git reset --hard checkpoint/phase-3-complete
```

The re-exports are still there — rolling back just means consumers go back to the old path. Nothing breaks.
