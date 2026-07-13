# Phase 3 - Split the Monolith

**Goal:** Transform the monolith file(s) into domain-organized modules. **Pure file moves - NO logic changes.**

**Risk:** Low if you use re-exports. High if you skip them.

## Skip if

- There is no monolith file (`lib/api.ts`, `lib/supabase.ts`, or equivalent with >20 exported functions spanning multiple domains).

If you only have god **screens** but no god **API file**, Phase 2 was enough - skip to Phase 5 for the final audit.

## 3.1 - Create Domain Modules

Using the monolith map from pre-flight, create one file per domain:

```
lib/api/
  index.ts           # Barrel export
  authApi.ts         # signUp, signIn, signOut, getProfile...
  itemsApi.ts        # createItem, getItems, updateItem...
  ordersApi.ts       # createOrder, getOrders, cancelOrder...
  messagingApi.ts    # sendMessage, getMessages, markRead...
  paymentsApi.ts     # charge, refund, getBalance...
  ...
```

For each function:

1. **Copy** (not move) from the monolith to the domain file.
2. Add necessary imports (DB client, types).
3. Export the function.

**Do NOT change any function signatures or internal logic.** Copy-paste only. If you spot a bug during the copy, note it - do NOT fix it here. Fix it in a follow-up commit after Phase 5.

## 3.2 - Add Re-Exports to the Monolith

After copying all functions out, replace the originals in the monolith file with re-exports:

```typescript
// lib/supabase.ts (temporary - keeps existing imports working)
export { signUp, signIn, signOut, getProfile } from './api/authApi';
export { createItem, getItems, updateItem } from './api/itemsApi';
export { createOrder, getOrders, cancelOrder } from './api/ordersApi';
// ... etc.

// Keep the client setup here - that's what the monolith file should end up owning.
export { supabase } from './supabase-client';
```

This is critical: **zero consumer files need to change their imports yet.** All existing `import { fn } from '@/lib/supabase'` statements keep working.

## 3.3 - Verify

Run the **code-validator** agent, then:

```bash
# Monolith should now be dramatically smaller (re-exports + client setup only).
wc -l lib/supabase.ts

# tsc must pass - re-exports preserve the public API.
npx tsc --noEmit

# Tests must pass - behavior unchanged.
npm test
```

If any of these fail, the copy missed something. Common causes:

- A function was skipped (compare export counts before/after).
- An internal helper used by multiple functions wasn't copied.
- A type used only inside the monolith wasn't exported.

## 3.4 - Create the Barrel Export

```typescript
// lib/api/index.ts
export * from './authApi';
export * from './itemsApi';
export * from './ordersApi';
export * from './messagingApi';
export * from './paymentsApi';
// ... etc.
```

This lets consumers optionally migrate to `import { fn } from '@/lib/api'` instead of the per-domain path - useful when a file needs functions from multiple domains.

## 3.5 - Watch for Circular Dependencies

Splitting a monolith can expose circular deps between functions that called each other:

```bash
# After the split, run any circular-dep detector your stack supports:
npx madge --circular --extensions ts,tsx lib/api/
```

If circular deps appear, move the shared helpers to `lib/api/_shared.ts` (the underscore signals "internal to the barrel").

## Checkpoint: `checkpoint/phase-3-complete`

- `tsc` clean.
- All imports still work via re-exports - `grep -rn "from '@/lib/supabase'"` count unchanged.
- Monolith is just client + re-exports.
- Tests green.
- No circular dependencies in `lib/api/`.

Tag:

```bash
git tag checkpoint/phase-3-complete
```

## Rollback

```bash
git reset --hard checkpoint/phase-2-complete
```

Then re-attempt Phase 3 in smaller batches (one domain at a time) if the full copy created issues you couldn't diagnose quickly.
