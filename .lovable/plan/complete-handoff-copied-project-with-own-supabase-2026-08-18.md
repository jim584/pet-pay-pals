# Complete Handoff: Copied Project with Own Supabase

## Goal
Finish setting up the remixed Lovable project that now uses your own Supabase backend, and confirm what the other Lovable already did.

## What the other Lovable reported
- Schema applied: 74 tables, 84 RPC/trigger functions, RLS + grants.
- All 54 edge functions deployed.
- Public pages load with no 404s/console errors.
- Two tasks left for you: add Edge Function secrets and rotate the access token.

## Verification against this codebase

| Item | Other Lovable | This project | Match |
|------|---------------|--------------|-------|
| Edge functions | 54 deployed | 54 in `supabase/functions/` | Yes |
| Migration files | 74 tables / 84 functions | 81 migration files, 70 public tables, 77 public functions | Close — small counting differences likely due to auth/storage schemas or views |
| Public pages load | Zero 404s/errors | Confirmed by other Lovable | Yes |

Conclusion: the copy looks structurally complete. The remaining work is secrets, email infrastructure, and a few config values.

## Secrets to add in the new Supabase project

Add these in Supabase → Edge Functions → Secrets (or via the new Lovable project's secret tools):

### Required for payments
- `STRIPE_SECRET_KEY` — your live/test Stripe secret key.
- `STRIPE_WEBHOOK_SECRET` — the webhook endpoint secret from your Stripe dashboard.

### Required for internal function calls
- `INTERNAL_FUNCTION_SECRET` — a random shared secret used to call edge functions from other edge functions/cron jobs. Generate a fresh strong value; do not reuse the old one.

### Required only if you use Stripe Issuing vet cards
- `ISSUING_ENABLED` — set to `"true"` to enable physical/virtual vet cards.
- `ISSUING_DEFAULT_AUTH_HOURS` — e.g. `"6"`.
- `ISSUING_BUSINESS_ADDRESS_LINE1`
- `ISSUING_BUSINESS_ADDRESS_CITY`
- `ISSUING_BUSINESS_ADDRESS_STATE`
- `ISSUING_BUSINESS_ADDRESS_POSTAL`
- `ISSUING_BUSINESS_ADDRESS_COUNTRY`

If you are not using Stripe Issuing, leave `ISSUING_ENABLED` unset or `"false"`; the card functions will return a friendly "not enabled" message.

### Optional email kill-switch
- `EMAILS_ENABLED` — defaults to `"false"`. Set to `"true"` only after you have replaced the Lovable email provider (see blockers below).

## Porting blockers you must resolve

### 1. Lovable email SDK will not work outside Lovable Cloud
Six edge functions import from `npm:@lovable.dev/email-js` and `npm:@lovable.dev/webhooks-js`:

- `auth-email-hook`
- `help-now-update-reminders`
- `release-campaign-redirection`
- `send-attestation-request`
- `send-bnpl-reminder`
- `send-vet-identity-link`

They all require `LOVABLE_API_KEY`, which is a Lovable-managed secret and is **not available** in a project that uses your own Supabase. Options:

A. **Replace with Resend / SendGrid / AWS SES** — rewrite the six functions to use your own email provider. This is the cleanest long-term fix.
B. **Keep emails disabled** — leave `EMAILS_ENABLED="false"`; the app works but no transactional emails are sent.
C. **Stay on Lovable Cloud for this project** — abandon the copy and keep using Lovable Cloud.

Recommended: option A if you need branded emails; option B if email is not yet live.

### 2. Auth email hook depends on Lovable webhook format
`auth-email-hook` is configured as a Supabase Auth hook and expects Lovable-signed webhook payloads. In your own Supabase project you must either:
- Disable the hook and use Supabase's built-in auth emails, or
- Re-implement the hook to verify Supabase's native webhook signature.

### 3. Custom email domain
This project uses `notify.plexaihub.com` as the sender domain. In the new project you must re-verify that domain (or a new one) with whichever email provider you choose.

### 4. Stripe webhook endpoint
The `STRIPE_WEBHOOK_SECRET` must come from a webhook endpoint registered to the new project's Edge Function URL, not the old one. Re-create the webhook in Stripe and copy the new signing secret.

## Immediate action plan

1. **Rotate the access token** the other Lovable asked you to paste — do this first.
2. **Add the required secrets** listed above to the new Supabase project.
3. **Decide on email**: disable emails initially (`EMAILS_ENABLED="false"`) or replace the six Lovable email functions before going live.
4. **Reconfigure Stripe webhooks** to point at the new Supabase function URL and update `STRIPE_WEBHOOK_SECRET`.
5. **Smoke-test** a sign-up, a BNPL plan, and a vet-ticket submission to confirm no 500s from missing secrets.
6. **Optional but recommended**: replace `@lovable.dev/email-js` with your own email provider so `LOVABLE_API_KEY` is no longer needed.

## Deliverable
A clear handoff checklist and a decision on the email-provider blocker so the copied project can go live without Lovable Cloud dependencies.
