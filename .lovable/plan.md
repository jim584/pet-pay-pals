I checked the current admin overview, payment sync function, webhook handler, and database state. The warning is legitimate right now: there are 3 active memberships, but `payment_history` has 0 rows. The likely remaining technical issue is that the current sync/webhook code uses `upsert(..., { onConflict: "stripe_invoice_id" })` against a partial unique index; Postgres/PostgREST does not treat that as a matching conflict target for this style of upsert, so invoice writes can still fail or be skipped.

Plan:

1. Make invoice recording idempotent without relying on the partial-index upsert
   - Update `backfill-payment-history` to check for an existing `stripe_invoice_id` first.
   - If the invoice exists, update it.
   - If it does not exist, insert it.
   - This avoids the `ON CONFLICT` problem and should allow the Sync Stripe payments button to populate `payment_history`.

2. Apply the same fix to the live Stripe webhook handler
   - Replace `payment_history.upsert(... onConflict: "stripe_invoice_id")` in `stripe-webhook` with a small helper that performs explicit select/update/insert by `stripe_invoice_id`.
   - Use it for `invoice.paid` and `invoice.payment_failed`.
   - Keep refund rows as normal inserts because they do not necessarily have a Stripe invoice ID.

3. Prevent duplicate Direct Pay accruals from webhook retries
   - In `stripe-webhook`, before inserting `direct_pay_accruals` for a paid invoice, check whether accrual rows already exist for that `stripe_invoice_id`.
   - This matches the backfill behavior and keeps repeated webhook delivery from creating duplicate Direct Pay balances.

4. Improve the admin overview warning so it is less confusing
   - Keep the alert only when active memberships exist and no payments have been recorded.
   - Update the text to say the next action is to click Sync Stripe payments first.
   - If sync succeeds, the warning disappears after reload.
   - If sync imports 0 invoices, the alert can then point to the Stripe webhook configuration as the next likely issue.

5. Re-deploy and verify the backend functions
   - Deploy `backfill-payment-history` and `stripe-webhook` after code changes.
   - Test the sync function with the current admin session.
   - Check that `payment_history` now has invoice rows and that the Overview page can show Recorded revenue / Recent payments instead of the warning.

Outcome expected after approval:
- You should not need to manually create payment history records.
- Clicking Sync Stripe payments should import the existing test subscription invoices.
- The warning should disappear once at least one invoice is recorded.
- The webhook should continue recording future Stripe invoices automatically, provided the webhook endpoint is configured in Stripe.