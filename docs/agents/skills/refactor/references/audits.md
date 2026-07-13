# Audit Scripts (Phase 5)

Run each audit against the refactored codebase. Grade A-D on each. The overall grade is the **lowest** section grade - the refactor is only as good as its weakest audit.

## 1. Type Safety Audit

```bash
# Count all unsafe casts (excluding tests and generated files)
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__ | grep -v __mocks__ | grep -v '\.d\.ts'

# Count total
TOTAL=$(grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__ | grep -v __mocks__ | wc -l)
echo "Total 'as any' occurrences: $TOTAL"

# Categorize (adjust patterns to what's common in your codebase)
echo "=== Library typing (often justified - icon/font names, etc.) ==="
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__ \
  | grep -cE "\.icon as any|name=.*as any"

echo "=== Router params (often justified in typed routers) ==="
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__ \
  | grep -cE "router\.(push|replace).*as any"

echo "=== Data access (usually fixable with proper types) ==="
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__ \
  | grep -cE "\(data as any\)|\(item as any\)|\(result as any\)"

echo "=== Enum casts (fixable with generated types) ==="
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__ \
  | grep -cE "'[a-z_]+' as any"
```

**Grading:**

| Grade | Condition |
|-------|-----------|
| A | 0 fixable `as any` |
| B | < 10 fixable `as any` |
| C | 10-30 fixable `as any` |
| D | > 30 fixable `as any` |

## 2. Dead Code Audit

```bash
# Re-exports that should have been stripped in Phase 5
grep -rn "export \* from\|export {.*} from" \
  lib/supabase.ts lib/api.ts 2>/dev/null

# Unused exports in domain modules (heuristic - false positives possible)
find lib/api -name "*.ts" -not -name "index.ts" -print0 \
  | while IFS= read -r -d '' f; do
      # Extract exported function / const names
      grep -E "^export (async )?function |^export const " "$f" \
        | sed -E 's/export (async )?function ([a-zA-Z0-9_]+).*/\2/; s/export const ([a-zA-Z0-9_]+).*/\1/' \
        | while IFS= read -r fn; do
            count=$(grep -rn "\\b${fn}\\b" --include="*.ts" --include="*.tsx" . \
              | grep -v node_modules | grep -v "^$f:" | wc -l)
            [ "$count" -eq 0 ] && echo "UNUSED: $fn in $f"
          done
    done
```

**Grading:**

| Grade | Condition |
|-------|-----------|
| A | No dead code, no stray re-exports |
| B | < 5 unused exports |
| C | Re-exports still present OR 5-15 unused |
| D | > 15 unused exports OR significant dead code |

## 3. Import Hygiene Audit

```bash
# Monolith function imports (should be 0 - adjust path if your monolith was named differently)
grep -rn "from '@/lib/supabase'\|from '@/lib/api\\.ts'" \
  app/ components/ hooks/ --include="*.ts" --include="*.tsx" \
  | grep -v "{ supabase }\|{ client }\|{ db }" | wc -l

# Dynamic imports from monolith (should be 0)
grep -rn "import('@/lib/supabase')\|import('@/lib/api')" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l

# Cross-domain API coupling (domain modules importing each other - watch for tight coupling)
find lib/api -name "*Api.ts" -print0 \
  | while IFS= read -r -d '' f; do
      grep -E "from '\.\/[a-zA-Z]+Api'" "$f" && echo "  ^ in $f"
    done
```

**Grading:**

| Grade | Condition |
|-------|-----------|
| A | Zero monolith imports, zero dynamic imports |
| B | 1-3 edge cases (e.g., a script, a config file) |
| C | 3-10 leaks - migration incomplete |
| D | > 10 leaks - Phase 4 was not finished |

## 4. Test Coverage Audit

```bash
# Test count (adjust to your runner's output format)
npm test -- --passWithNoTests 2>&1 | tail -5

# Hooks without tests
find hooks -name "*.ts" -not -name "index.ts" -print0 2>/dev/null \
  | while IFS= read -r -d '' hook; do
      name=$(basename "$hook" .ts)
      test_file=$(find __tests__ -name "*${name}*" 2>/dev/null | head -1)
      [ -z "$test_file" ] && echo "  NO TEST: $hook"
    done

# Utilities without tests
find lib -maxdepth 1 -name "*.ts" -not -name "*.d.ts" -print0 2>/dev/null \
  | while IFS= read -r -d '' util; do
      name=$(basename "$util" .ts)
      test_file=$(find __tests__ -name "*${name}*" 2>/dev/null | head -1)
      [ -z "$test_file" ] && echo "  NO TEST: $util"
    done
```

**Grading:**

| Grade | Condition |
|-------|-----------|
| A | 80%+ of hooks tested, all critical utilities tested |
| B | 50-80% of hooks tested |
| C | Some tests, but < 50% of hooks |
| D | Minimal or no tests |

## 5. Architecture Conformance Audit

```bash
# Functions per domain module (catches uneven splits)
echo "=== Functions per module ==="
find lib/api -name "*Api.ts" -print0 \
  | while IFS= read -r -d '' f; do
      count=$(grep -c "^export " "$f")
      printf "  %3d functions: %s\n" "$count" "$(basename "$f")"
    done

# Inline subscriptions remaining in app/ (should be 0)
grep -rn "\.channel(\|\.subscribe(\|onSnapshot(\|new WebSocket(" \
  app/ --include="*.tsx" 2>/dev/null \
  | grep -v node_modules | wc -l

# Manual cache patterns (should be 0 in migrated screens)
grep -rn "cacheRef\|CACHE_TTL\|setCacheTime" \
  app/ --include="*.tsx" 2>/dev/null \
  | grep -v node_modules | wc -l

# God files remaining (>500 lines)
find app/ components/ hooks/ lib/ \( -name "*.ts" -o -name "*.tsx" \) -not -path '*/node_modules/*' -print0 2>/dev/null \
  | xargs -0 wc -l 2>/dev/null | sort -rn | awk '$1 > 500 { print }' | head -10

# Monolith line count (should be ~20 lines)
wc -l lib/supabase.ts lib/api.ts 2>/dev/null
```

**Grading:**

| Grade | Condition |
|-------|-----------|
| A | Clean domain split, zero inline subs, no god files |
| B | 1-2 minor gaps (one screen with inline sub, one borderline god file) |
| C | Several screens not migrated, or 3+ god files still present |
| D | Refactor partially applied, inconsistent structure |

## 6. Duplication Audit

```bash
# Duplicate status / constant definitions
grep -rn "ACTIVE_STATUSES\|PENDING_STATUSES\|STATUS_COLORS" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__

# Duplicate format functions
grep -rn "function format\|const format" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__

# Duplicate helper patterns - adjust names to your codebase
grep -rn "function capitalize\|function truncate\|function formatDate" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | grep -v __tests__
```

**Grading:**

| Grade | Condition |
|-------|-----------|
| A | Zero duplicate definitions |
| B | < 3 minor duplicates |
| C | 3-10 duplicates |
| D | Widespread duplication |

## Using the Results

1. Compile the results into the report template in [phases/phase-5-audit-cleanup.md](../phases/phase-5-audit-cleanup.md).
2. **The overall grade is the lowest section grade.**
3. If the overall grade is C or D, fix those issues before tagging `post-refactor`.
4. Keep the filled-in report - it documents what the refactor actually achieved.
