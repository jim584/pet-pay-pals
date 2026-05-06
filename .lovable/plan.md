## Goal
Take one real vet ticket through every stage of the pipeline in your live app and confirm — by reading the database after each step — that the status transitions exactly as expected:

```
submitted → approved → funded → card_issued
```

This proves the whole chain (auth → submit fn → coverage compute → approve fn → Stripe Checkout → webhook signature → internal-secret handoff → issue-vet-card → DB writes) works in stub mode, before we flip Issuing on.

## What I'll do (read + verify only — no code changes)

### Step 1 — Pre-flight DB check
Confirm you have at least one pet, one active membership (for Direct Pay coverage), and a Direct Pay accrual to draw from. If any are missing, I'll tell you what to create first.

### Step 2 — Submit a ticket (you drive the UI, I watch the DB)
You go to **Dashboard → Vet Tickets → New Ticket** and submit one with:
- A pet you own
- Clinic name (anything, e.g. "Test Clinic")
- Estimate amount (e.g. $200)
- Skip file uploads or attach a small dummy PDF

After you click submit, I'll query `vet_tickets` and confirm:
- A new row exists with `status = 'submitted'`
- `owner_id`, `pet_id`, `estimate_amount` are correct

### Step 3 — Approve as admin (you drive, I watch)
You go to **Admin → Vet Tickets**, open the ticket, click **Compute coverage**, then **Approve**.

I'll re-query `vet_tickets` and confirm:
- `status = 'approved'`
- `approved_amount` is set
- `coverage_breakdown` JSON has `dp_use`, `member_remainder`, etc.
- A `ticket_dp_consumptions` row was inserted (DP allocated)

### Step 4 — Pay the member remainder (you drive Stripe Checkout)
From the owner side, click **Pay remainder** → Stripe Checkout opens → use:
- Card: `4242 4242 4242 4242`
- Expiry: any future date (e.g. `12/34`)
- CVC: any 3 digits
- ZIP: any 5 digits

Stripe will redirect you back. The `stripe-webhook` will fire `checkout.session.completed`, mark the ticket `funded`, then internally invoke `issue-vet-card`.

I'll then query `vet_tickets` and confirm in sequence (polling for ~30s):
- `status` flips `approved → funded → card_issued`
- `member_remainder_paid = true`
- `card_id` is populated (will be a stub ID like `ic_stub_…` since `ISSUING_ENABLED=false`)
- `authorized_until` is ~6 hours from now
- A `vet_payouts` row was created with `method='manual_ach'`, `status='pending'`

### Step 5 — Final summary
I'll give you a clean table showing the status at each step and the key fields, so you can see the whole flow worked. If anything stalls, I'll pull the relevant edge function logs (`submit-vet-ticket`, `approve-vet-ticket`, `compute-ticket-coverage`, `collect-member-remainder`, `stripe-webhook`, `issue-vet-card`) and show you exactly where it broke.

## What I need from you to start
1. **Confirm you're logged in** in the preview as a pet owner who has at least one pet and an active membership.
2. **Tell me your user_id or email** so I can target queries to your tickets specifically (otherwise I'll grab the most recently created ticket and assume it's yours).
3. **Click Approve** on this plan, then I'll begin with the pre-flight DB check and tell you when to take each UI action.

## Notes
- Everything runs in Stripe Test mode against your sandbox keys — no real money moves.
- The card stays in stub mode (`ISSUING_ENABLED=false`), so we won't hit Stripe Issuing APIs yet. The flow stops cleanly at `card_issued`. Settlement (`card_issued → settled`) requires real Stripe Issuing, which we'll test after Stripe approves you.
- I'm only reading the DB and watching logs — no migrations, no code edits in this loop.
