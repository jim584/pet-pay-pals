Plan: Switch Stripe integration to live mode

1. Update backend secrets
   - Replace `STRIPE_SECRET_KEY` with the live `sk_live_...` key.
   - Replace `STRIPE_WEBHOOK_SECRET` with the live `whsec_...` value.

2. Verify live webhook endpoint
   - Endpoint: `https://vobbumbhncydapxweukr.supabase.co/functions/v1/stripe-webhook`
   - Confirm selected events match the handlers in `supabase/functions/stripe-webhook/index.ts`.

3. Check codebase for test-mode leftovers
   - Search for any hardcoded `sk_test_...`, `whsec_...`, or test-only Stripe logic.

4. Smoke test
   - Trigger a live Stripe event (small checkout or Stripe test-event) and verify the Edge Function responds correctly.

Next step: user approval to update the two secrets via the secure form.