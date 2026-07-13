# Phase 0bis - Boundaries & Guards

**Goal:** Fix cross-boundary leakage - wrong roles accessing wrong screens, deep-link bypasses, unprotected routes.

**Risk:** Low. Adding guards, not changing logic.

## Skip if

- Your app has no role-based access control (single-role app), OR
- Every protected route already uses a guard hook or middleware, AND
- Deep links / push-notification handlers already validate the user's role before navigating.

## 0bis.1 - Create the Role Guard Hook

```typescript
// hooks/useRequireRole.ts
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context'; // adjust path
import { useRouter } from 'expo-router';      // or next/router, react-router-dom, etc.

type Role = 'admin' | 'pro' | 'client';

export function useRequireRole(requiredRole: Role) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || profile?.role !== requiredRole) {
      router.replace('/'); // or your app's fallback route
    }
  }, [loading, user, profile, requiredRole, router]);

  return {
    authorized: !!user && profile?.role === requiredRole,
    loading,
  };
}
```

Adjust types to the real shape of your auth context. The point is a **single source** for role checks - every protected screen calls this hook instead of rolling its own.

## 0bis.2 - Add Guards to All Unprotected Screens

Find screens that should be role-gated but aren't:

```bash
# Screens in role-scoped directories without any auth check
grep -rL "useRequireRole\|useAuth\|requireAuth" \
  app/admin/ app/pro/ app/dashboard/ 2>/dev/null
```

Add the guard hook at the top of each screen component. Commit one directory at a time - a bad guard that redirects everyone is easier to revert in a small PR.

## 0bis.3 - Fix Deep Link / Notification Bypasses

Deep links and push-notification taps can route users to screens they shouldn't see. Audit the handlers:

```bash
# Find deep-link / notification navigation points
grep -rn "Linking.openURL\|router.push\|router.replace\|navigation.navigate" \
  app/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

For each navigation point, add role validation **before** the navigation call. Common fix:

```typescript
function handleNotificationTap(notification: Notification) {
  const { profile } = useAuth();
  const targetRoute = notification.data.route;

  if (requiresRole(targetRoute, 'pro') && profile?.role !== 'pro') {
    router.replace('/');
    return;
  }
  router.push(targetRoute);
}
```

## Validation Gate

Run the **code-validator** agent. Must report PASS.

## Checkpoint: `checkpoint/phase-0bis-complete`

Manual test checklist:

- As a `client`, visit a `pro/*` URL → redirects to fallback.
- As a `client`, open a deep link to a `pro/*` screen → redirects.
- As the correct role, the same routes work normally.

Tag:

```bash
git tag checkpoint/phase-0bis-complete
```

## Rollback

```bash
git reset --hard checkpoint/phase-0-complete
```

Guards that accidentally redirect every user are the #1 failure mode here. If you see a post-deploy spike in session-end events from authenticated users, revert immediately and audit the guard logic.
