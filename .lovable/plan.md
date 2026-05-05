## Goal
Wire up your three new Stripe Issuing secrets so the vet-card flow runs in Stripe sandbox/test mode.

## Steps

### 1. Add the three secrets
I'll open the secret form and request these three values. You paste them in:

- **`STRIPE_WEBHOOK_SECRET`** — the `whsec_...` value Stripe gave you when you created the webhook endpoint at `https://vobbumbhncydapxweukr.supabase.co/functions/v1/stripe-webhook` (in Test mode)
- **`INTERNAL_FUNCTION_SECRET`** — any long random string, e.g. `hap_internal_8f3k29dj4kfn2x9vmq7bz1ps`. Used so `stripe-webhook` can securely invoke `issue-vet-card` server-to-server.
- **`ISSUING_ENABLED`** — set to `false` for now. The code will keep running in stub mode (cards marked `card_issued` without calling Stripe). We flip this to `true` after Stripe approves Issuing on your account.

`STRIPE_SECRET_KEY` is already set — I won't touch it. If you'd like to swap the existing key for your `sk_test_...` so everything runs in sandbox, tell me and I'll update it in the same step.

### 2. Verify the webhook signature works
After secrets are saved, I'll send a test event from the Stripe Dashboard ("Send test webhook" → `checkout.session.completed`) and tail the `stripe-webhook` edge function logs to confirm:
- Signature verification passes (no "Webhook Error" in logs)
- Event is parsed and acknowledged with `200 received: true`

### 3. Sanity-check the ticket → card flow in stub mode
With `ISSUING_ENABLED=false`, walk one ticket through:
- Submit ticket → admin approves → member pays remainder via Checkout (test card `4242 4242 4242 4242`)
- Webhook receives `checkout.session.completed`, marks ticket `funded`, then internally calls `issue-vet-card`
- Ticket flips to `card_issued` with a stub `card_id` and a 6-hour `authorized_until` window
- Confirm `/dashboard/vet-tickets` shows the card-issued state

This proves the whole pipeline (auth, webhook signature, internal-secret handoff, DB updates) works without needing Stripe Issuing approval yet.

### 4. (Optional) Add a "Simulate clinic charge" admin button
If you want to test the settlement half of the flow without a physical terminal, I can add a small admin-only button on the ticket detail page that:
- Calls a new edge function which uses Stripe's `/v1/test_helpers/issuing/authorizations` API to create a fake authorization + capture against the issued card
- Triggers the `issuing_authorization.request`, `issuing_transaction.created`, and `issuing_card.updated` webhook handlers end-to-end
- Lets you watch the ticket go `card_issued` → `settled`, refund unused DP, and freeze the card

This requires `ISSUING_ENABLED=true` and a real (test-mode) issued card, so it'd be the last step once Stripe approves Issuing.

## What I need from you
Just click Approve below. The secret form pops up immediately after and you paste the three values.
