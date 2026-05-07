## Goal

When an admin signs in, send them straight to the Admin Dashboard Overview (`/admin`), regardless of any `?redirect=` query param.

## Current Behavior

`src/pages/Auth.tsx` (line 48) already routes admins to `/admin`, but it honors `safeRedirect` first:

```ts
if (role === "admin") navigate(safeRedirect ?? "/admin", { replace: true });
```

So if the admin landed on `/auth?redirect=/some-pet-page` (e.g. clicked a "Sign in" link from a public page), they get bounced into the public app instead of the admin dashboard.

Additionally, `src/pages/admin/AdminLayout.tsx` only checks `loading` — not the new `roleLoading` flag — so on a fresh admin login it can briefly evaluate `role !== "admin"` before the role fetch resolves and bounce them to `/`.

## Changes

1. **`src/pages/Auth.tsx`** — For admins, always navigate to `/admin` and ignore `safeRedirect`:
   ```ts
   if (role === "admin") navigate("/admin", { replace: true });
   ```

2. **`src/pages/admin/AdminLayout.tsx`** — Pull `roleLoading` from `useAuth()` and treat `loading || (user && roleLoading)` as the loading state, so the layout waits for the role fetch before redirecting non-admins. Also send unauthenticated visitors to `/auth?redirect=/admin` so they come back to the admin dashboard after signing in.

No DB or routing-config changes needed.