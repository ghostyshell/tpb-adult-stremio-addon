# Phase 2 - Break the Monster Files

**Goal:** Decompose god files into focused modules. Extract types, hooks, and components.

**Risk:** Moderate - touching core screens. One sub-task at a time.

## Skip if

- No file in `app/` / `components/` / `screens/` is over 500 lines, AND
- `as any` count is already under 10, AND
- Constants and formatters are not duplicated.

If any of those are true individually, you can still skip the corresponding sub-phase.

## Sub-phase 2a - Types + Constants

### Create Shared Types

Centralize the data shapes used across the app:

```typescript
// types/api.types.ts
export type UserWithRelations = User & {
  profile?: Profile;
  settings?: UserSettings;
};

export type JobWithRelations = Job & {
  client?: Profile;
  pro?: Profile;
  reviews?: Review[];
};
```

### Kill `as any` Casts

Start with the worst offender:

```bash
grep -c "as any" path/to/worst-file.ts
```

Replace each cast with either:

- A proper type (preferred).
- A runtime guard (when the source genuinely could return anything).
- A documented `as unknown as X` with a comment explaining why (last resort).

**Never keep `as any` without a note.** If a linter rule (`@typescript-eslint/no-explicit-any`) is available, enable it.

### Centralize Duplicate Constants

Find duplication:

```bash
grep -rn "ACTIVE_STATUSES\|STATUS_COLORS\|VALID_TYPES" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Move to a single file (`constants/`) with one canonical definition, and delete all duplicates.

### Deduplicate Format Utilities

```bash
grep -rn "function format\|const format" \
  --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Consolidate into `lib/format.ts`. Write tests for each utility as you move them (if they don't have tests already).

## Sub-phase 2b - Extract Custom Hooks from Large Screens

For each screen over 500 lines, identify hook-extractable logic:

| Pattern | Extract to |
|---------|-----------|
| Map / location / GPS logic | `hooks/useMap.ts` |
| Search / autocomplete / debounce | `hooks/useSearch.ts` |
| Form state / validation | `hooks/useForm.ts` |
| Animation / gesture state | `hooks/useAnimation.ts` |
| Modal / sheet / panel state | `hooks/usePanel.ts` |
| Data fetching + cache | `hooks/queries/useDomainData.ts` |
| Feature-flag gating | `hooks/useFeatureFlag.ts` |

**Rule:** each hook should be testable in isolation. If you cannot describe what it does in one sentence, it's too big - split it.

## Sub-phase 2c - Create Mutation Hooks

For actions that modify server state, create mutation hooks next to their query hooks:

```typescript
// hooks/queries/useItems.ts (add alongside the query)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createItem } from '@/lib/api/itemsApi';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateItemInput } from '@/types';

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newItem: CreateItemInput) => {
      const { data, error } = await createItem(newItem);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all() });
    },
  });
}
```

Use optimistic updates only when the UX benefit is real - they add complexity.

## Sub-phase 2d - Extract Presentational Components

For screens still over 300 lines after hook extraction, pull out UI sections:

```
components/
  domain/
    SearchBar.tsx        # Pure UI + onSearch callback
    ItemCard.tsx         # Renders one item
    StatusBanner.tsx     # Conditional banner display
    FilterTabs.tsx       # Tab switching UI
    index.ts             # Barrel export
```

Wrap presentational components with `React.memo` when they receive stable props - but don't memo eagerly, only when a profiler shows a render-cost issue.

## Validation Gate

Run the **code-validator** agent after each sub-phase. Do not batch - each sub-phase is independently verifiable.

## Checkpoint: `checkpoint/phase-2-complete`

- Largest screen reduced by 50%+ from baseline.
- `as any` count reduced by 70%+.
- All screens render correctly.
- `npx tsc --noEmit` clean.
- Tests green.

Tag:

```bash
git tag checkpoint/phase-2-complete
```

## Rollback

Per sub-task:

```bash
git revert <sha>
```

Full phase:

```bash
git reset --hard checkpoint/phase-1-complete
```

If a hook extraction breaks one screen, it often indicates the hook coupled to screen-specific state - rewrite the hook's public API, don't patch the consumer.
