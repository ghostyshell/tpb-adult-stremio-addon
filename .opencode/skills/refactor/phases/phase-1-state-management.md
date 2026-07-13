# Phase 1 — State Management Pilot + Realtime Hooks

**Goal:** Replace manual `useState` + `useEffect` + `fetch` patterns with proper server-state management. Extract realtime subscriptions into dedicated hooks.

**Risk:** Isolated — one screen at a time, easy to revert.

## Skip if

- The codebase already uses React Query / SWR / TanStack Query consistently, AND
- Realtime subscriptions are already in dedicated hooks (not inline in screens).

If only one is true, run the relevant sub-phase.

## 1.1 — Pilot: Pick ONE Screen

Choose the **simplest list screen** that:

- Fetches data on mount.
- Has pull-to-refresh (or a manual refresh button on web).
- Has loading and error states.

Do NOT start with the most complex screen. The pilot's job is to validate the pattern — speed matters more than impact here.

### Create a Query Hook

```typescript
// hooks/queries/useItems.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { getItems } from '@/lib/api'; // or wherever the fetch function lives today
import { queryKeys } from '@/lib/queryKeys';

export function useItems() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.items.byUser(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await getItems();
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
```

Write unit tests for this hook using the wrapper from Phase 0ter. Only then migrate the screen to use it.

## 1.2 — CRITICAL CHECKPOINT

**Run code-validator agent.** Then manually test the pilot screen:

- Data loads on mount.
- Pull-to-refresh works.
- Tab switching does not trigger a double-fetch.
- Loading / error states render correctly.
- Back-navigation preserves cached data (no flicker).

**If broken → revert 1.1 immediately.** Do not proceed until the pilot is solid — the pattern becomes a template for dozens of hooks later.

## 1.3 — Extract Realtime Subscriptions

Find all inline realtime subscriptions:

```bash
# Supabase
grep -rn "\.channel(\|\.subscribe(\|\.on('postgres_changes'" \
  --include="*.tsx" . | grep -v node_modules

# Raw WebSockets
grep -rn "new WebSocket(" --include="*.tsx" . | grep -v node_modules

# Firestore snapshot listeners
grep -rn "onSnapshot(" --include="*.tsx" . | grep -v node_modules
```

Extract each into a dedicated hook. Example for Supabase:

```typescript
// hooks/realtime/useItemUpdates.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';
import { queryKeys } from '@/lib/queryKeys';

export function useItemUpdates(
  itemId: string | undefined,
  onUpdate?: (item: unknown) => void,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!itemId) return;

    const channel = supabase
      .channel(`item-updates:${itemId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items',
          filter: `id=eq.${itemId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.items.detail(itemId),
          });
          onUpdate?.(payload.new);
        },
      )
      .subscribe();

    // CRITICAL: always remove the channel on unmount.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId, queryClient, onUpdate]);
}
```

**Pattern:** one hook = one channel. Hook manages lifecycle. Cache invalidation replaces manual `setState`.

For non-Supabase stacks, adapt: WebSocket → `ws.close()`, Firestore → `unsubscribe()`, EventSource → `source.close()`. The shape is the same: subscribe in `useEffect`, cleanup on unmount.

## 1.4 — Migrate Realtime Call Sites

Replace inline `.channel().subscribe()` / `onSnapshot()` / `new WebSocket()` calls in screens with the extracted hooks. **One screen per PR.**

After each migration:

1. Run code-validator.
2. Manually verify the realtime behavior (send an update from another client / tab, confirm UI reacts).

## Validation Gate

Run the **code-validator** agent.

## Checkpoint: `checkpoint/phase-1-complete`

- Pilot screen works with the query hook.
- All inline realtime subscriptions are extracted to hooks.
- `grep "\.channel(" app/` returns 0 results (or equivalent for your stack).
- Realtime flows work end-to-end (chat, live updates, notifications).

Tag:

```bash
git tag checkpoint/phase-1-complete
```

## Rollback

Per-screen:

```bash
git revert <pilot-migration-sha>
```

Full phase:

```bash
git reset --hard checkpoint/phase-0ter-complete
```

Realtime issues are the hardest to catch — if you suspect a regression, check the network tab / realtime dashboard for duplicate subscriptions before rolling back.
