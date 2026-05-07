# Build Admin Payments Page

Replace the "Coming soon" placeholder at `/admin/payments` with a full payments dashboard backed by the existing `payment_history` table (already populated by Stripe webhook + backfill function).

## What you'll see

- **KPI cards** (filtered by current range): Gross collected, # successful payments, Refunded total, Failed count
- **Filters**: search (name / description / Stripe invoice ID / payment intent), status, kind (Membership / Member remainder / Donation / One-time), and time range (7d / 30d / 90d / 1y / all)
- **Transactions table**: date, user (full name from profiles), kind badge, description, status badge, amount (currency-formatted), invoice link (hosted Stripe URL or PDF)
- **Sync from Stripe** button — calls the existing `backfill-payment-history` edge function and refreshes

## Files

1. **Create** `src/pages/admin/AdminPaymentsPage.tsx` — full page implementation using shadcn `Card`, `Table`, `Select`, `Input`, `Badge`, `Button`. Reads `payment_history` directly (admin RLS already grants SELECT) and joins user names from `profiles` in JS.
2. **Edit** `src/App.tsx` — replace
   ```tsx
   <Route path="payments" element={<AdminPlaceholder title="Payments" />} />
   ```
   with `<Route path="payments" element={<AdminPaymentsPage />} />` and import the new page.

## Notes

- No DB changes, no new edge functions — everything reuses existing schema (`payment_history`) and the `backfill-payment-history` edge function already wired in `admin-api.ts` via `triggerStripeBackfill()`.
- Currency formatted with `Intl.NumberFormat`. Status colors via existing semantic tokens.
- Out of scope for this task: refund/void actions (would require a new edge function with Stripe secret) and the separate `/admin/reserve` (Wallet & Reserve) placeholder — let me know if you want those next.
