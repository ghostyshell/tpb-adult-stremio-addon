# Common Pitfalls

Issues you'll hit during a real refactor. Each has a quick diagnosis and a fix.

## 1. Dynamic Imports Invisible to Static Grep

**Symptom:** You migrated all `import { fn } from '@/lib/supabase'` statements, stripped the re-exports, and a feature breaks at runtime.

**Cause:** `const { fn } = await import('@/lib/supabase')` is not caught by static grep for `from '@/lib/supabase'`.

**Fix:**

```bash
# Search for dynamic imports separately
grep -rn "import('@/lib/supabase')\|require('@/lib/supabase')" \
  --include="*.ts" --include="*.tsx" .
```

Do this **before** Phase 5. Dynamic imports are common in:

- Lazy-loaded route components.
- Feature flags that gate entire modules.
- Analytics / telemetry that loads on demand.

## 2. Circular Dependencies After Splitting

**Symptom:** After Phase 3, you get `ReferenceError: Cannot access 'X' before initialization` at runtime, or `tsc` reports odd import errors.

**Cause:** Functions in the monolith called each other. Once split into separate files, they create a cycle:

```
itemsApi.ts → imports from ordersApi.ts
ordersApi.ts → imports from itemsApi.ts
```

**Fix:** Move shared helpers to a neutral file:

```
lib/api/
  _shared.ts       # helpers both itemsApi and ordersApi need
  itemsApi.ts      # imports only from _shared and external deps
  ordersApi.ts     # imports only from _shared and external deps
```

The underscore prefix signals "internal to the barrel — not part of the public API."

Detect cycles:

```bash
npx madge --circular --extensions ts,tsx lib/api/
```

## 3. Re-Export Removal Timing

**Symptom:** You thought migration was done, stripped the re-exports, and CI turns red.

**Cause:** One of:

- A test file / config file / storybook story still imports from the monolith.
- A dynamic import exists (see #1).
- A consumer outside the grep paths (e.g., `scripts/` or `tools/`).

**Fix:** Never remove re-exports until Phase 5. Before removing, run:

```bash
# Search EVERYWHERE, not just app/
grep -rn "from '@/lib/supabase'\|import('@/lib/supabase')" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" . \
  | grep -v node_modules | grep -v "{ supabase }\|{ client }"

# Should return 0 before stripping.
```

## 4. Test Mock Paths Go Stale

**Symptom:** After Phase 3 split, tests pass, but you notice the mocks are not being called — the real implementation runs.

**Cause:** `jest.mock('@/lib/supabase')` only mocks that path. Moving `getItems` to `@/lib/api/itemsApi` doesn't automatically redirect the mock.

**Fix:** Update every mock that targets a moved function:

```typescript
// Before
jest.mock('@/lib/supabase', () => ({
  getItems: jest.fn(),
  getUsers: jest.fn(),
}));

// After
jest.mock('@/lib/api/itemsApi', () => ({ getItems: jest.fn() }));
jest.mock('@/lib/api/usersApi', () => ({ getUsers: jest.fn() }));
```

Audit:

```bash
grep -rn "jest.mock('@/lib/supabase')" \
  __tests__/ --include="*.ts" --include="*.tsx" 2>/dev/null
```

## 5. Realtime Cleanup Forgotten

**Symptom:** Opening and closing the same screen 3–4 times causes events to fire multiple times per update. Or memory usage climbs.

**Cause:** The `useEffect` subscribing to a realtime channel doesn't call `removeChannel` / `unsubscribe` / `.close()` on unmount.

**Fix:** Always return a cleanup function:

```typescript
useEffect(() => {
  const channel = supabase.channel('…').subscribe();
  return () => {
    supabase.removeChannel(channel); // CRITICAL
  };
}, [deps]);
```

Adapt per backend:

- **Supabase:** `supabase.removeChannel(channel)`
- **Firestore:** the `onSnapshot` return value is the unsubscribe fn — return it directly.
- **WebSocket:** `ws.close()`
- **EventSource:** `source.close()`

## 6. Cache Key Typos

**Symptom:** Mutations don't invalidate queries. Data stays stale until hard refresh.

**Cause:** Typo in a hardcoded `queryKey` array:

```typescript
useQuery({ queryKey: ['items', userId], ... });        // list
queryClient.invalidateQueries({ queryKey: ['item', userId] }); // mutation — typo: 'item' not 'items'
```

**Fix:** Always use the registry:

```typescript
useQuery({ queryKey: queryKeys.items.byUser(userId), ... });
queryClient.invalidateQueries({ queryKey: queryKeys.items.byUser(userId) });
```

The registry is type-checked — typos become compile errors.

## 7. Unicode in String Helpers

**Symptom:** Capitalize / title-case functions produce garbled output for accented names: `"Ménage Régulier"` becomes `"MéNage RéGulier"`.

**Cause:** Regex `\b\w` is ASCII-only. `\w` matches `[A-Za-z0-9_]`, so accented characters are treated as word boundaries.

**Fix:** Use Unicode property escapes with the `u` flag:

```typescript
// Broken
str.replace(/(^|\s)(\w)/g, (_, space, letter) => space + letter.toUpperCase());

// Correct
str.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase());
```

## 8. React `act()` Warnings

**Symptom:** Every hook test logs:
`Warning: An update to TestComponent inside a test was not wrapped in act(...)`

**Cause:** React 18+ strict concurrent mode requires explicit opt-in in tests.

**Fix:** Set the global flag in test setup:

```typescript
// __tests__/setup.ts
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
```

And wrap state-triggering assertions in `act`:

```typescript
import { act } from '@testing-library/react';

await act(async () => {
  result.current.refetch();
});
```

**Do not suppress the warning** — it hides real issues.

## 9. Backend Types Don't Cover Joins

**Symptom:** After splitting API modules, `tsc` flags join-heavy queries as `never` types or `any`.

**Cause:** Auto-generated types (e.g., `supabase gen types typescript`, Prisma, drizzle-kit) cover table shapes but not arbitrary joins.

**Fix:** Supplementary types in `types/api.types.ts`:

```typescript
import type { Database } from '@/types/database.generated';

type ItemRow = Database['public']['Tables']['items']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

export type ItemWithOwner = ItemRow & {
  owner: Pick<UserRow, 'id' | 'name' | 'avatar_url'>;
};
```

## 10. Commit Granularity

**Symptom:** A PR with 50 files changed across 8 different concerns is impossible to review, and if it breaks production, you can't bisect.

**Cause:** Batching multiple sub-tasks into one commit.

**Fix:** **1 PR = 1 sub-task.** If a commit message needs "and" or a bullet list, split it. Bisect is your #1 debugging tool during a refactor — don't disable it.
