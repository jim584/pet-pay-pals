## Goal

In `/admin/payments`, when a row's kind is `member_remainder` (or a new `bnpl_*` kind), show the linked BNPL obligation (provider, original amount, outstanding, status) and a collapsible installment schedule from `bnpl_payments`.

## Current gaps found

1. `payment_history` currently has **no** rows for `member_remainder` — the `vet_ticket_remainder` branch of `stripe-webhook` updates the ticket and creates a vet_payout but never inserts a `payment_history` row. (Confirmed: the only kind in DB today is `membership_invoice`.)
2. There is no link column from `payment_history` → `vet_tickets` or `bnpl_obligations`. Installments live only in `bnpl_payments` keyed by `obligation_id`.
3. `bnpl_obligations` is keyed to `ticket_id` + `owner_id`, not to a payment row.

## Plan

### 1. DB migration — add link columns + record member-remainder payments

- Add nullable columns to `payment_history`:
  - `vet_ticket_id uuid`
  - `bnpl_obligation_id uuid`
- Index both for join speed.
- No RLS changes (admin SELECT already covers it; owner SELECT stays user-scoped).

### 2. Edge function update — `stripe-webhook`

In the `vet_ticket_remainder` branch (around line 71), after marking the ticket funded, insert a `payment_history` row:

```ts
await admin.from("payment_history").insert({
  user_id: ticket.owner_id,
  kind: "member_remainder",
  status: "paid",
  amount: (s.amount_total ?? 0) / 100,
  currency: s.currency || "usd",
  description: `Vet bill member remainder — ${ticket.clinic_name}`,
  stripe_payment_intent_id: pi,
  vet_ticket_id: ticketId,
  bnpl_obligation_id: <obligation lookup by ticket_id, if any>,
  occurred_at: new Date().toISOString(),
});
```

Also add idempotency check by `stripe_payment_intent_id` (mirroring the donation branch).

### 3. Admin Payments UI — `src/pages/admin/AdminPaymentsPage.tsx`

- Extend `PaymentRow` type with `vet_ticket_id`, `bnpl_obligation_id`.
- After fetching a page, batch-load:
  - `vet_tickets` (id, clinic_name, estimate_amount, approved_amount) for any `vet_ticket_id`
  - `bnpl_obligations` (id, provider, original_amount, outstanding_amount, status, external_ref) for any `bnpl_obligation_id` **and** for any ticket that has an obligation (look up by `ticket_id` so existing rows without a direct link still resolve)
  - `bnpl_payments` for those obligations (single `.in("obligation_id", ids)` query)
- Attach `ticket`, `obligation`, `installments[]` to each row in JS.
- In the table, when `r.kind === "member_remainder"` or `r.obligation` exists:
  - Add a chevron button on the row that toggles an expanded sub-row (`<TableRow>` with `colSpan=7`).
  - Expanded panel shows two cards:
    - **BNPL agreement**: provider, original amount, outstanding, status badge, external ref, created date.
    - **Installment schedule**: small table of `bnpl_payments` (date, method, amount, ref, notes); plus computed "Paid X of Y" summary.
  - If no obligation exists for a `member_remainder` row, show a single line: "No BNPL plan — paid in full via Stripe Checkout."

### 4. Out of scope

- Admin actions to record/edit BNPL payments from this page (already exists in the dedicated BNPL admin section).
- Backfilling historical `member_remainder` rows (none exist yet).

### Files touched

```text
supabase/migrations/<new>.sql                       (new)
supabase/functions/stripe-webhook/index.ts          (edit)
src/pages/admin/AdminPaymentsPage.tsx               (edit)
```
