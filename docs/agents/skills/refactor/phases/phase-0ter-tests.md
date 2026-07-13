# Phase 0ter - Test Foundation

**Goal:** Write tests for existing behavior BEFORE refactoring. These tests become your regression safety net for Phases 1-5.

**Risk:** None. Read-only analysis of existing code.

## Skip if

- The project already has 50+ passing tests covering critical paths, OR
- You're going to introduce tests organically per-feature during Phase 1 (acceptable trade-off if you're disciplined).

If you skip, document in the pre-flight plan **which critical flows are NOT test-covered** - you'll still need a manual checklist at every checkpoint.

## 0ter.1 - Unit Tests for Pure Utilities

Start with the easiest wins - pure functions with no side effects:

```bash
# Find pure utility files (no React, no hooks)
grep -rL "import.*from.*react\|useEffect\|useState" \
  lib/ utils/ --include="*.ts" 2>/dev/null | head -20
```

Write tests for: formatting, validation, calculation, parsing. Target **15-30 test cases** for the most-used utilities.

Example:

```typescript
// __tests__/format.test.ts
import { formatPrice, formatDuration } from '@/lib/format';

describe('formatPrice', () => {
  it('formats integer cents as decimal currency', () => {
    expect(formatPrice(1500)).toBe('15.00');
  });

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  it('rounds to two decimals', () => {
    expect(formatPrice(1499)).toBe('14.99');
  });
});
```

## 0ter.2 - Mock Infrastructure

Create reusable mocks for your core dependencies:

```
__tests__/
  __mocks__/
    backend-client.ts   # DB / API client
    auth-context.ts     # auth provider
    router.ts           # navigation
    http-client.ts      # fetch / axios / etc.
  setup.ts              # global test setup
```

Use typed mocks - **not `any`**. A typed mock is its own lightweight check that your mock matches the real shape:

```typescript
// __tests__/__mocks__/auth-context.ts
import type { User, Profile } from '@/types';

type AuthState = {
  user: Pick<User, 'id'> | null;
  profile: Profile | null;
  loading: boolean;
};

let mockProfile: Profile | null = null;

export const useAuth = jest.fn<AuthState, []>(() => ({
  user: mockProfile ? { id: mockProfile.id } : null,
  profile: mockProfile,
  loading: false,
}));

export function setMockProfile(profile: Profile | null) {
  mockProfile = profile;
}

export function resetAuthMocks() {
  mockProfile = null;
  jest.clearAllMocks();
}
```

## 0ter.3 - Hook Tests

Write tests for the hooks created in Phase 0bis (role guards) and any critical existing hooks.

Testing React Query hooks needs a wrapper:

```typescript
// __tests__/helpers/createQueryWrapper.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Critical for React 18+:** enable concurrent act environment in the setup file:

```typescript
// __tests__/setup.ts
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
```

Without this, every render triggers an `act()` warning and hides real issues.

## 0ter.4 - E2E Flow Definitions (Optional)

If you use Maestro, Detox, or Playwright, define critical user flows as executable specs:

1. Main happy path (create → process → complete).
2. Auth flow (login → access protected → logout).
3. Error recovery (network failure → retry → success).
4. Realtime (send message → appears without refresh).
5. Draft / save / resume flow.

Even if you can't automate all of them immediately, write the spec down - Phase 5 will audit against this list.

## Validation Gate

Run the **code-validator** agent. Then:

```bash
npm test
```

All green. No `act()` warnings (if they appear, fix them - don't filter them out).

## Checkpoint: `checkpoint/phase-0ter-complete`

- `npm test` is green.
- Test count ≥ 50 (aim for this, adjust to codebase size).
- App boots unchanged - behavior preservation verified.

Tag:

```bash
git tag checkpoint/phase-0ter-complete
```

## Rollback

```bash
git reset --hard checkpoint/phase-0bis-complete
```

Tests shouldn't break existing behavior, but if you accidentally mocked something that's used in production setup, rollback and isolate.
