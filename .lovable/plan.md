## Problem

Clicking "Add/Remove" role on an admin's Users page fails with an edge function error. The `admin-assign-role` function returns **401 Unauthorized** before doing anything.

**Root cause:** The function pins `https://esm.sh/@supabase/supabase-js@2.49.1`, which bundles `@supabase/auth-js@2.68.0`. That version does **not** include the `auth.getClaims()` method (it was added in auth-js 2.71). So the call

```ts
const { data: claims } = await supabase.auth.getClaims(token);
if (!claims?.claims) return 401;
```

throws/returns undefined and the request is rejected before the admin check ever runs. (No logs appear because the runtime swallows the error and the response is the early 401.)

The same bug exists in several other edge functions that use `getClaims` with the 2.49.1 SDK (`admin-update-membership`, `approve-vet-ticket`, `reject-vet-ticket`, `pay-bnpl-installment`, `collect-member-remainder`, `get-card-ephemeral-key`, `issue-vet-card`, `request-physical-vet-card`). Several of those are likely also failing silently for admins/users.

## Fix

Replace `auth.getClaims(token)` with `auth.getUser(token)` (which exists in the bundled SDK and returns the authenticated user from the JWT). It does the same job here — verify the token and pull the caller's user id.

In every affected edge function, change:

```ts
const { data: claims } = await supabase.auth.getClaims(token);
if (!claims?.claims) return 401;
const callerId = claims.claims.sub as string;
```

to:

```ts
const { data: userData, error: userErr } = await supabase.auth.getUser(token);
if (userErr || !userData?.user) return 401;
const callerId = userData.user.id;
```

### Files to update

1. `supabase/functions/admin-assign-role/index.ts` — primary fix for the reported bug.
2. `supabase/functions/admin-update-membership/index.ts`
3. `supabase/functions/approve-vet-ticket/index.ts`
4. `supabase/functions/reject-vet-ticket/index.ts`
5. `supabase/functions/pay-bnpl-installment/index.ts`
6. `supabase/functions/collect-member-remainder/index.ts`
7. `supabase/functions/get-card-ephemeral-key/index.ts`
8. `supabase/functions/issue-vet-card/index.ts`
9. `supabase/functions/request-physical-vet-card/index.ts`

No client/UI or DB changes needed. Functions auto-deploy.

## Verification

After the change, re-test from the admin Users page (Add Vet → Remove Vet). Should succeed and the user's roles list updates.
