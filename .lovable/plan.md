## Goal
Create a new auth user `admin@helpapet.com` with password `Emirates@1234` and grant it the `admin` role so it can access `/admin`.

## Why a script (not raw SQL)
The `auth.users` table is managed by Supabase Auth — passwords must be hashed by the auth service, so we can't `INSERT` directly. We'll use the Supabase Admin API (service role) from a one-off edge function.

## Steps

1. **Create a one-off edge function `bootstrap-admin`** that:
   - Uses `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.createUser({ email: 'admin@helpapet.com', password: 'Emirates@1234', email_confirm: true })`.
   - Inserts `{ user_id, role: 'admin' }` into `public.user_roles` (also inserts a `profiles` row if the `handle_new_user` trigger didn't fire — it should).
   - Returns the new user id.
   - Configured with `verify_jwt = false` so we can hit it once from the browser/curl.

2. **Invoke it once** from the browser console (or I'll trigger it via the test tool) to provision the user.

3. **Delete the bootstrap function** immediately after — leaving an unauthenticated admin-creation endpoint live would be a critical security hole.

4. **You log in** at `/auth` with:
   - Email: `admin@helpapet.com`
   - Password: `Emirates@1234`
   
   Then visit `/admin` — the admin sidebar (Memberships, Vets, Payment Plans, etc.) will appear.

## Recommendation
**Change the password after first login** via the account settings, since it was shared in chat history.

Approve and I'll execute steps 1–3.