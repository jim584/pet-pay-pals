# Fix: Login stuck + Autopay skeleton

## Root causes

**1. Login stuck on the login screen (Sam)**
Sam (`sam@helpapet.com`) has no row in `user_roles` (verified in DB). In `src/pages/Auth.tsx`, the post-auth redirect effect is:

```ts
if (role === "admin") navigate("/admin");
else if (role) navigate("/");
// roleless users → no navigation → stuck on /auth
```

So any user without a role row never gets redirected. They're authenticated, but the Auth page just sits there.

**2. "Set up Autopay" → blank skeleton on /dashboard/payment-plans**
The `setup-bnpl-autopay` edge function was throwing `supabase.auth.getClaims is not a function` (500). The button kicks off a `window.location.href = url` redirect, but since the function failed before returning a Stripe URL, the page never navigates and looks frozen on the skeleton briefly. This was already fixed in the prior turn (replaced `getClaims` with `getUser`). No further code change needed — just verify by clicking again.

## Changes

### `src/pages/Auth.tsx`
Add fallback redirect for authenticated users without a role to `/select-role`:

```ts
useEffect(() => {
  if (loading || !user) return;
  // ...referral attach...
  if (role === "admin") navigate("/admin", { replace: true });
  else if (role) navigate("/", { replace: true });
  else navigate("/select-role", { replace: true }); // NEW
}, [user, role, loading, navigate]);
```

`DashboardLayout` already redirects roleless users to `/select-role`, so this just makes the Auth page consistent.

### Autopay
No code change. The 500 was fixed last turn. After this plan is approved I'll verify the edge function is deployed and the redirect to Stripe Checkout works.
