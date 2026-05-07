## Goal
When an admin signs in, land them directly on `/admin` (the Admin dashboard with sidebar: Overview, Users & Roles, Vets, Vet Tickets, Memberships, Payments, Payment Plans, Wallet & Reserve, plus Shortcuts) instead of the public home page.

## Current behavior
`src/pages/Auth.tsx` calls `navigate("/")` after both sign-in and sign-up, regardless of role. Admins then have to manually click into `/admin`.

## Change

**`src/pages/Auth.tsx`**
- Pull `user` and `role` from `useAuth()` in addition to `signIn`/`signUp`.
- Remove the immediate `navigate("/")` calls inside `handleSubmit`.
- Add a `useEffect` that watches `user` and `role`: once a session exists, redirect to `/admin` if `role === "admin"`, otherwise `/`. This handles the async role fetch in `AuthContext` (role is loaded via `setTimeout` after sign-in, so we can't read it synchronously right after `await signIn`).
- Keep the existing toast on successful signup.
- Also: if a user is already authenticated when they land on `/auth`, the same effect will route them appropriately (nice side-effect, no extra code).

## Out of scope
- No changes to `AdminLayout` (it already guards non-admins).
- No changes to the sidebar contents — those modules already render at `/admin`.
- No changes to `Index`/home routing for non-admins.