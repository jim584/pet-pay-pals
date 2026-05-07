## Fix the recurring BNPL autopay skeleton/loading loop

### What is actually happening
I checked the browser replay and network activity. The autopay function is returning a valid Stripe Checkout URL successfully. The page is not failing at the initial BNPL query — it returns an empty obligations list quickly.

The remaining failure is the return/handoff flow:
- The app redirects the top window to Stripe checkout.
- When the user returns, the page relies on the Stripe webhook to have already saved `default_payment_method_id`.
- There are no recent `stripe-webhook` records for the attempted autopay setup, so the card status never updates.
- The UI keeps waiting/confirming or lands back in auth/dashboard loading instead of showing a clear recovery path.

### Plan

1. **Add a dedicated autopay confirmation backend function**
   - Create a new backend function, e.g. `confirm-bnpl-autopay`.
   - Input: `session_id` from the Stripe return URL.
   - Validate the signed-in user.
   - Retrieve the Stripe Checkout Session and SetupIntent directly.
   - Verify the session metadata belongs to the current user and is `bnpl_autopay_setup`.
   - Save the resulting payment method to the user profile.
   - Return `{ default_payment_method_id }`.
   - This makes return-from-Stripe work even if the webhook is delayed, missing, or not configured.

2. **Update the client BNPL API**
   - Add `confirmAutopaySetup(sessionId)` in `src/lib/bnpl-api.ts` using `supabase.functions.invoke()`.
   - Keep `getAutopayStatus()` as a fallback/status check.

3. **Fix `AutopaySetupCard` return handling**
   - On `?autopay=success&session_id=...`, call `confirmAutopaySetup(session_id)` first instead of only polling the profile.
   - Only show “Confirming card setup…” while that request is actively running.
   - Always end in a clear state:
     - success: “A card is on file…”
     - still missing card: show a warning message and a “Try setup again” button
     - cancelled: show cancelled message and normal setup button
   - Clear `autopay` and `session_id` URL params after handling.

4. **Stop dashboard auth loading from becoming endless**
   - Add a timeout fallback to `DashboardLayout`’s auth loading state so the user sees a clear “Still loading your account” card with a retry/login action instead of an infinite full-page `Loading...`.
   - Preserve normal redirects for unauthenticated users and role selection.

5. **Preserve intended destination through login**
   - When `/dashboard/payment-plans` redirects to `/auth`, include a redirect parameter.
   - After login, send the user back to `/dashboard/payment-plans` when that was the requested page, instead of always sending them home.

6. **Keep the BNPL empty state usable**
   - Keep the empty-state checklist and Set up autopay button.
   - If setup returns without card confirmation, show recovery messaging rather than skeletons.

### Files to change
- `supabase/functions/confirm-bnpl-autopay/index.ts` — new backend function.
- `src/lib/bnpl-api.ts` — add confirm API helper.
- `src/components/payments/AutopaySetupCard.tsx` — self-healing return handling and clear failure state.
- `src/pages/DashboardLayout.tsx` — timeout fallback for account loading.
- `src/pages/Auth.tsx` — respect redirect param after login.

### Verification
- Click Set up autopay from `/dashboard/payment-plans`.
- Confirm the `setup-bnpl-autopay` request returns a Stripe URL.
- Simulate returning to `/dashboard/payment-plans?autopay=success&session_id=...`.
- Confirm the new function saves the payment method and the page exits loading.
- Confirm users with no BNPL obligations see the empty state, not skeletons.
- Confirm unauthenticated users are redirected to login and then back to payment plans.