# Vet Payment Ticket System — Help A Pet

End-to-end flow: pet owner uploads vet estimate + attestation → system computes coverage from the payment stack → issues a merchant-locked, time-boxed virtual/physical card tied to the pet → owner taps card at clinic.

## Critical infrastructure dependency

This design requires **Stripe Issuing**, a separate Stripe product from regular payments. It is the only way to programmatically create virtual + physical cards with merchant-lock, amount-lock, and time-window spend controls.

You must apply for Stripe Issuing in your Stripe dashboard (Issuing → Get started). Approval typically takes a few business days and requires a US-based Stripe account (UK/EU is also supported but with a separate flow). This is a pre-requisite — the build can proceed without it for the ticket workflow + ledger, but the actual card-issuing step will be stubbed until Issuing is approved.

I'll structure the build in phases so you get value immediately and the card piece slots in cleanly when Stripe Issuing is approved.

---

## Phase 1 — Ticket workflow + payment-stack engine (no cards yet)

### Database schema

**`vet_tickets`** — owner-submitted reimbursement requests
- `id`, `pet_id`, `owner_id`, `vet_profile_id` (nullable, free-text fallback), `clinic_name`, `clinic_merchant_id` (nullable, captured later)
- `estimate_amount` numeric, `estimate_url` text (storage), `attestation_url` text (storage)
- `status` enum: `submitted | under_review | approved | rejected | funded | card_issued | settled | expired | cancelled`
- `coverage_breakdown` jsonb — { direct_pay, bnpl, reserve, member_remainder }
- `approved_amount`, `card_id` (nullable, Phase 3), `authorized_until` timestamptz
- `admin_notes`, `rejection_reason`, timestamps

**`ticket_dp_consumptions`** — which DP accruals fed which ticket (oldest-first FIFO)
- `id`, `ticket_id`, `accrual_id`, `amount_consumed`, `created_at`

**`bnpl_obligations`** — outstanding BNPL balances per pet (reduces future capacity)
- `id`, `pet_id`, `ticket_id`, `provider` (e.g. `affirm | klarna | stripe_capital`), `original_amount`, `outstanding_amount`, `status`, timestamps

**`reserve_pool`** — community reserve balance (already partially exists as `community_reserve`; add a per-pet eligibility view)

**`vet_payouts`** — record of money sent to vets (card auths in Phase 3, manual in Phase 1)
- `id`, `ticket_id`, `amount`, `method` enum: `manual_ach | issued_card | direct_charge`, `external_ref`, `status`, timestamps

Add storage bucket `vet-tickets` (private) for estimates/attestations.

### Edge functions

**`submit-vet-ticket`** — owner uploads, creates ticket in `submitted` state, validates pet ownership.

**`compute-ticket-coverage`** — pure calculator (callable from review UI):
1. Pull pet's active membership + plan.
2. **Plan-year cap check**: sum approved+funded+settled tickets in the current membership year, ensure (sum + new) ≤ plan_cap (Bronze $10k, Silver $15k, Gold $20k, Platinum unlimited).
3. **DP availability**: sum `direct_pay_accruals.remaining_amount` for user (already FIFO sorted by accrual_month asc), capped by plan's DP accrual window (Bronze 1y, Silver 2y, Gold 3y, Platinum unlimited).
4. **BNPL capacity**: estimate – DP, minus existing outstanding `bnpl_obligations` for that pet, clamped by plan rules.
5. **Reserve eligibility**: only if member has been active ≥ X months and plan tier qualifies (Ryan to confirm rules; placeholder threshold).
6. **Member remainder**: anything left over.
Returns the breakdown JSON for admin review and member display.

**`approve-vet-ticket`** (admin) — locks coverage breakdown, transitions to `approved`, decrements DP accruals via FIFO into `ticket_dp_consumptions`, creates `bnpl_obligations` rows in `pending` state, holds member remainder for Stripe/ACH collection.

**`reject-vet-ticket`** (admin) — sets reason, notifies owner.

### Plan-year cap helper (DB function)
`get_plan_year_window(membership_id)` → returns `(start_ts, end_ts)` based on `started_at` anniversary, used by both cap-check and reporting.

### UI

- **Owner**: new `/vet-ticket/new` route with upload form (estimate file, attestation file, vet selector + free-text, estimate amount, notes). Ticket list at `/dashboard/vet-tickets` showing status timeline.
- **Admin**: `/admin/vet-tickets` queue with file viewers, computed breakdown panel, Approve / Reject / Request more info actions.
- **Wallet view**: section showing active tickets, plan-year cap remaining, DP available within window.

---

## Phase 2 — Member-remainder collection + BNPL hand-off

**`collect-member-remainder`** edge function — creates a Stripe Checkout (or PaymentIntent) for the member-responsible portion. Webhook moves ticket from `approved` → `funded` once member paid.

**BNPL integration** — Phase 2a treats BNPL as manual: admin records the BNPL provider + amount externally and marks the obligation funded. Phase 2b (later) wires a real BNPL API (Affirm/Klarna/Stripe Capital) once provider is chosen.

Once `coverage_breakdown.member_remainder` is collected and BNPL is confirmed, ticket moves to `funded` and is ready for card issuance (Phase 3).

In the interim (before Phase 3 ships), `funded` tickets generate a `vet_payouts` row with method=`manual_ach` for admin to wire/check the vet directly. This unblocks real usage immediately.

---

## Phase 3 — Stripe Issuing: merchant-locked virtual + physical cards

Triggered automatically when a ticket reaches `funded`.

**`issue-vet-card`** edge function:
1. Ensure a Stripe Issuing **Cardholder** exists for the pet owner (cache `cardholder_id` on `profiles`).
2. Create a **virtual card** immediately:
   - `spending_controls.spending_limits`: `[{ amount: approved_amount_cents, interval: 'all_time' }]`
   - `spending_controls.allowed_merchants`: `[clinic_merchant_id]` if known; else fall back to `allowed_categories: ['veterinary_services']` (MCC 0742) — note this is broader and we should record the trade-off.
   - Metadata: `{ ticket_id, pet_id, authorized_until }`.
3. If owner opted for a physical card too, also create a physical card shipped to owner's address (one-time, not per-ticket — re-used across future tickets with updated spending controls).
4. Persist `card_id`, `last4`, `exp`, `authorized_until = now() + 6h` on the ticket.
5. Return card details (PAN/CVC retrieved client-side via Stripe.js `issuing.cards.retrieve` with ephemeral key — never log full PAN server-side).

**`expire-vet-card-auth`** — pg_cron job every 15 min:
- For tickets where `authorized_until < now()` and status = `card_issued` and no successful auth yet → set `spending_controls.spending_limits` to `[{ amount: 0 }]` to neutralize the card, mark ticket `expired`, return DP/reserve/BNPL allocations to their pools.

**Stripe Issuing webhook handler** (extend `stripe-webhook`):
- `issuing_authorization.request` → real-time approval hook: re-verify ticket is still `card_issued`, amount ≤ approved, merchant matches → approve; else decline.
- `issuing_authorization.created` (approved) → mark ticket `settled`, create `vet_payouts` row with method=`issued_card`, freeze further auths on the card.
- `issuing_transaction.created` → reconcile final settled amount; if less than authorized, refund the delta back to DP/reserve.

**Owner card UI** (`/dashboard/vet-tickets/:id/card`):
- Show "Card ready" screen with embedded Stripe Issuing card display (PAN + CVC fetched via ephemeral key, never persisted).
- Apple Pay / Google Pay push-provisioning button (Stripe Issuing supports this).
- Countdown timer to `authorized_until`.
- Instructions: "Show this card to the clinic. Tap, swipe, or read the number aloud."

---

## Phase 4 — Polish

- Email/SMS notifications at each status transition (uses existing `auth-email-hook` infrastructure pattern).
- Admin dashboard: outstanding BNPL obligations per pet, plan-cap utilization charts, expired-auth recovery report.
- Audit log table `ticket_audit_log` capturing every status change + actor.
- Reserve pool eligibility rules (Ryan to define exact qualifying criteria).

---

## Technical details

### Stripe Issuing key facts
- Separate API surface from regular Stripe payments; same `STRIPE_SECRET_KEY` works once Issuing is enabled on the account.
- **Real-time authorization webhook** must respond within 2 seconds — keep the handler minimal (one DB read, one comparison, return decision). Heavier reconciliation happens on `issuing_authorization.created`.
- Spending controls support: `allowed_categories` (MCC list), `blocked_categories`, `allowed_merchants` (specific merchant IDs from prior auths), `spending_limits` (amount + interval).
- The `clinic_merchant_id` is only knowable after the *first* successful auth at that clinic — store it from the `issuing_authorization` payload so future tickets to the same vet can lock tighter.
- Funding: Issuing cards spend from your Stripe Issuing balance, which you fund from your Stripe payments balance or an external bank — admin process, not user-facing.

### Plan-year window
Anchored to `memberships.started_at`. Year N = `[started_at + (N-1) years, started_at + N years)`. Renewals reset the cap on each anniversary.

### DP accrual window enforcement
When summing DP availability for a ticket, exclude accruals where `accrual_month < (today − plan.dp_window_months)`. Existing `process-dp-expiry` cron already expires them; this is a belt-and-suspenders check at coverage time.

### FIFO consumption
`SELECT … FROM direct_pay_accruals WHERE user_id=? AND expired=false AND remaining_amount>0 ORDER BY accrual_month ASC, created_at ASC FOR UPDATE` — atomically decrement `remaining_amount` and write `ticket_dp_consumptions` rows in one transaction (DB function `consume_dp_for_ticket`).

### Rollback on expiry
If a card auth window expires unused, a reverse DB function `release_ticket_allocations` re-credits the consumed accruals (only if the original accrual is still within its expiry window) and voids the BNPL obligation rows.

### Security
- RLS: owners see only their own tickets; admins see all; vets see none of this surface (they don't need an account here — they just accept the card).
- Storage: `vet-tickets` bucket is private, signed-URL access only, scoped to ticket owner + admins.
- Card PAN never logged; only `last4` + `card_id` persisted server-side.

---

## What I'll build in this first implementation pass

To keep scope manageable, the **first build** will deliver Phase 1 + Phase 2 stubs:

1. All DB tables, RLS, FIFO consumption function, plan-year window function.
2. `submit-vet-ticket`, `compute-ticket-coverage`, `approve-vet-ticket`, `reject-vet-ticket` edge functions.
3. Storage bucket + upload helpers.
4. Owner submit form + ticket list.
5. Admin review queue.
6. Wallet integration showing plan-year cap remaining + active tickets.
7. Member-remainder Stripe Checkout (Phase 2).
8. Manual `vet_payouts` rows for `funded` tickets (admin pays vet out-of-band until Phase 3 ships).

Stripe Issuing wiring (Phase 3) ships in a follow-up message **once you confirm Stripe Issuing is approved on your account**. I'll flag the exact moment to apply.

Confirm and I'll start building Phase 1 + 2.
