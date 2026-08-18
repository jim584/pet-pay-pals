# Secrets Setup & Live Testing for the Copied Project

Goal: finish the copied project (the one on your own Supabase) so payments and emails actually work, then verify both end to end.

## Phase 1 — Fill in the secrets

Enter these in the copied project's backend secrets:

| Secret | Source |
|---|---|
| `SB_ACCESS_TOKEN` | Supabase account → Access Tokens (only needed by the other agent for deploys; rotate the one already pasted in chat) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Created in Phase 2 |
| `INTERNAL_FUNCTION_SECRET` | Value in `INTERNAL_FUNCTION_SECRET.txt` from the handoff pack |
| `RESEND_API_KEY` | Resend → API keys |
| `EMAILS_ENABLED` | `false` at first, `true` after domain verification |
| `ISSUING_*` | Only if Stripe Issuing vet cards are in use |

## Phase 2 — Stripe webhook

1. In Stripe, add an endpoint pointing at the copied project's `stripe-webhook` function URL.
2. Subscribe to the checkout, subscription, invoice, charge/refund and dispute events the handler already listens for.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Phase 3 — Email provider swap

The six functions that import the Lovable email SDK must be switched to Resend, using the patches already prepared in the handoff pack:
`help-now-update-reminders`, `release-campaign-redirection`, `send-attestation-request`, `send-bnpl-reminder`, `send-vet-identity-link`, plus the rewritten `auth-email-hook`.
Add the shared `resend-email.ts` wrapper, apply the five diffs, replace the auth hook file, verify a sending domain in Resend, then flip `EMAILS_ENABLED` to `true`.

## Phase 4 — Verification checklist

Payments
- Membership checkout completes and the subscription row appears.
- Webhook deliveries show 200 in Stripe.
- BNPL checkout creates the obligation and ledger entries.
- A refund and a dispute each write the expected ledger rows.

Emails
- Signup / password reset arrive via the rewritten auth hook.
- Attestation request email delivers with a working token link.
- BNPL reminder and campaign update reminder functions send when invoked manually.

Core app
- Vet ticket submission auto-approves and coverage follows Direct Pay → BNPL → Reserve → Help a Pet Now.
- Public pages load with no console errors.

## Notes

This work happens in the copied project, not here. I can produce the exact secret values, patch files and a step-by-step runbook you (or the other agent) paste in; I can't reach that project's backend directly from this one.
