# Phase 0 — Prerequisites

**Goal:** Install tooling, clean git state, create the foundation layers that all other phases build on.

**Risk:** None. Additive only.

## Skip if

- Your project already has a healthy git history (no uncommitted artifacts) AND
- A server-state library is already installed (React Query, SWR, or TanStack Query) AND
- A test runner is already configured and working AND
- You have a centralized query-key registry (or equivalent).

If only some of these are true, run the relevant sub-steps and skip the rest.

## 0.1 — Git Cleanup

1. **Triage uncommitted files**: `.gitignore` local artifacts (build output, `.env.local`, editor files), commit infrastructure files (configs, setup scripts).
2. **Tag the starting point**: `git tag pre-refactor-stable`.
3. **Create refactor branch**: `git checkout -b refactor/architecture`.

Verify:

```bash
git status          # must be clean
git tag | grep pre-refactor-stable   # must exist
```

## 0.2 — Install Server State Management

**Skip if:** already using `@tanstack/react-query`, `swr`, or `@tanstack/vue-query`.

Install the right library for the stack:

```bash
# React, React Native, Next.js
npm install @tanstack/react-query

# Vue 3
npm install @tanstack/vue-query

# Svelte
npm install @tanstack/svelte-query
```

Create the client configuration:

```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      // `refetchOnWindowFocus` only applies on the web. Safe to leave default on RN.
    },
  },
});
```

Wrap the app root with `<QueryClientProvider>`.

## 0.3 — Install Test Framework

**Skip if:** `npm test` already runs and reports results.

```bash
# React Native (Expo)
npm install --save-dev jest-expo @types/jest @testing-library/react-native \
  react-test-renderer @types/react-test-renderer

# React (Vite)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom

# Next.js
npm install --save-dev jest jest-environment-jsdom @testing-library/react \
  @testing-library/jest-dom @types/jest
```

Create:

- Test config (`jest.config.js`, `vitest.config.ts`, or equivalent).
- Global setup file (mocks, polyfills, `IS_REACT_ACT_ENVIRONMENT = true`).
- Path alias mapping matching `tsconfig.json` `paths`.

Verify:

```bash
npm test -- --passWithNoTests
```

## 0.4 — Create Cache Key Registry

Centralized query keys prevent cache misses and enable targeted invalidation.

```typescript
// lib/queryKeys.ts
export const queryKeys = {
  users: {
    all: () => ['users'] as const,
    detail: (id: string) => ['users', id] as const,
  },
  posts: {
    all: () => ['posts'] as const,
    byUser: (userId: string) => ['posts', 'user', userId] as const,
    detail: (id: string) => ['posts', id] as const,
  },
  // Add domains as you discover them in Phase 1.
} as const;
```

Use this **always** — never hardcode strings in `queryKey: [...]`. Typos in keys cause stale-data bugs invisible in tests.

## Validation Gate

Run the **code-validator** agent. Must report PASS before committing.

## Checkpoint: `checkpoint/phase-0-complete`

- App boots on dev server / simulator / device.
- `npx tsc --noEmit` returns zero errors.
- `npm test -- --passWithNoTests` exits 0.
- Query key registry file exists and is imported by the query client setup.

Tag:

```bash
git tag checkpoint/phase-0-complete
```

## Rollback

If Phase 0 breaks anything:

```bash
git reset --hard pre-refactor-stable
git branch -D refactor/architecture
```

Then start over. Phase 0 is additive — if it's not clean, redo it, don't patch it.
