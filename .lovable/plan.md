# Fix: Admin Revenue shows $0 despite active subscriptions

## What I found

Your DB currently has:
- **3 active memberships** (Together™ 10k ×2, Together™ 15k ×1, monthly billing) — created today via Stripe Checkout
- **0 rows** in `payment_history`
- **0 rows** in `sponsorship_donations` / `bnpl_payments`

The Overview "Revenue (30d)" KPI sums `payment_history.amount WHERE status='paid'` — and `payment_history` is **only populated by the `stripe-webhook` edge function** when Stripe fires `invoice.paid`. Since no `invoice.paid` webhook has been received (likely because `STRIPE_WEBHOOK_SECRET` isn't wired up to a real Stripe endpoint pointing at this project, or the test events haven't fired yet), the table is empty and revenue reads $0 — even though subscriptions are live in `memberships`.

So the KPI is technically correct ("paid invoices recorded"), but it doesn't reflect the value of active subscriptions or any non-Stripe revenue (donations, BNPL).

## Plan

### 1. Broaden the Revenue KPI (most useful fix)
Change `fetchAdminKpis` in `src/lib/admin-api.ts` to return **three** revenue figures instead of one:

- **Recorded revenue (30d)** — current value from `payment_history` (paid Stripe invoices + remainders)
- **MRR from active memberships** — sum of `membership_plans.membership_fee` for all memberships where `status='active'` (annual plans contribute `annual_price/12`). This shows recurring value even before the next invoice fires.
- **Donations (30d)** — sum of `sponsorship_donations.amount` in the last 30 days

Show all three on the Overview page as separate cards (replace the single "Revenue (30d)" card with: "MRR", "Recorded 30d", "Donations 30d").

### 2. Backfill `payment_history` for existing test subscriptions
The 3 active subscriptions have `stripe_subscription_id`s but no payment_history rows. Add a small admin-only edge function `backfill-payment-history` that:
- Lists invoices from Stripe for each `stripe_subscription_id` on active memberships
- Upserts them into `payment_history` (idempotent via `stripe_invoice_id`)
- Also creates the corresponding `direct_pay_accruals` rows that the webhook would have created

Trigger it once from the admin Overview page via a small "Sync Stripe payments" button (admin-only, uses `has_role` check).

### 3. Verify the Stripe webhook is actually reachable
Add a **"Stripe webhook health"** mini-card on Overview that simply shows:
- Last `payment_history` row time (or "never")
- A note + link to where the user should configure the webhook endpoint in their Stripe dashboard if it's stale

This makes the root cause visible instead of silently showing $0 forever.

## Files to change

- `src/lib/admin-api.ts` — extend `AdminKpis`, add `mrr`, `donations30d`, `lastPaymentAt`; add `triggerStripeBackfill()` invoker
- `src/pages/admin/AdminOverviewPage.tsx` — render new cards + "Sync Stripe payments" button + webhook health note
- `supabase/functions/backfill-payment-history/index.ts` — **new** edge function (verify_jwt, admin role check via service-role lookup)
- `supabase/config.toml` — register the new function

## Out of scope (ask if you want it)

- Including **pending** memberships in MRR (currently 0 anyway)
- Pulling **historical** Stripe revenue beyond what the connected account has invoices for
- A full /admin/payments table page (you already have AdminPaymentPlansPage for BNPL)

Approve and I'll implement steps 1–3.