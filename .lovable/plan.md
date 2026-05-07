## Problem

After login, users with an existing role are redirected to `/select-role` even though their role is already saved. Then clicking a role throws an RLS violation (because a role row already exists), confirming the role is in fact stored.

## Root Cause

In `AuthContext.tsx`, when a user signs in, `onAuthStateChange` fires with `SIGNED_IN`. The handler sets `user`/`session` synchronously but kicks off `fetchRole(...)` inside `setTimeout(..., 0)` — it does NOT update any loading flag.

Meanwhile, `Auth.tsx` has this effect:

```ts
useEffect(() => {
  if (loading || !user) return;
  ...
  if (role === "admin") navigate(...);
  else if (role) navigate("/", ...);
  else navigate("/select-role", ...);   // <-- fires while role is still null
}, [user, role, loading, ...]);
```

`loading` was already `false` (from the initial `getSession()` call when no user existed). The moment `user` becomes truthy, the effect runs while `role` is still `null` (fetch hasn't returned yet) → it navigates to `/select-role` before the role arrives. Same race exists in `DashboardLayout.tsx` (`if (!role) return <Navigate to="/select-role" />`).

## Fix

Add an explicit `roleLoading` flag to `AuthContext` that is true whenever a user exists but their role hasn't been fetched yet. Gate the role-based redirects on it.

### Changes

1. **`src/contexts/AuthContext.tsx`**
   - Add `roleLoading: boolean` to context type and provider value.
   - Set `roleLoading = true` whenever a new `user` is detected (initial `getSession` path AND `onAuthStateChange` `SIGNED_IN`/`TOKEN_REFRESHED` paths), and set it back to `false` in `fetchRole`'s `finally`.
   - When user is null, `roleLoading = false`.

2. **`src/pages/Auth.tsx`**
   - Read `roleLoading` from `useAuth()`.
   - Change guard to `if (loading || roleLoading || !user) return;` so we only redirect once the role lookup has resolved.

3. **`src/pages/DashboardLayout.tsx`**
   - Read `roleLoading` from `useAuth()`.
   - While `roleLoading` is true, render the existing skeleton/loader instead of redirecting to `/select-role`.

No DB or RLS changes are needed — the role is being saved correctly; only the client-side redirect timing is wrong.