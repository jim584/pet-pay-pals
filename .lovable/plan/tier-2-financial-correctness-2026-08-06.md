# Tier 2 — Financial correctness

Three changes: one money ledger that everything else reads from, per-pet binding of benefits, and correct card-settlement handling.

## 6. Append-only ledger as the single source of truth

Today money state lives in several mutable places (`direct_pay_accruals.remaining_amount`, `member_reserve_accruals.remaining_amount`, `bnpl_obligations.outstanding_amount`, `wallets.*`, `community_reserve.balance`). Any bug or double-run silently rewrites a balance with no trail.

Introduce a single `ledger_entries` table that is insert-only (no updates or deletes allowed, enforced by a trigger and by grants):

- Each entry records: account (which pet/member/pool the money belongs to), bucket (direct_pay, member_reserve, community_reserve, wallet, bnpl), amount signed, entry type, lifecycle state, source reference (ticket, obligation, Stripe object), and an idempotency key.
- Entry types cover the full lifecycle: `accrual`, `hold`, `hold_release`, `finalize`, `reversal`, `expiry`, `payout`.
- Every write carries an idempotency key with a unique index, so a replayed webhook or a re-run cron job can never double-post.

Lifecycle handled explicitly:

```text
accrual ──► hold ──► finalize        (funds actually spent)
              └────► hold_release    (ticket cancelled/expired)
accrual ──────────► expiry           (DP window lapses)
finalize ─────────► reversal         (refund / dispute / settle-under)
```

Balances become derived: `available = accruals - finalized - active holds - expiries + releases + reversals`. Expose them through read-only views (`v_pet_dp_balance`, `v_member_reserve_balance`, `v_community_reserve_balance`) so the app reads one number computed the same way everywhere.

Migrate existing behaviour rather than duplicating it: the current consume/release functions (`consume_dp_for_ticket`, `release_ticket_allocations`, `consume_reserve_for_ticket`, `release_reserve_for_ticket`, `apply_bnpl_payment`, DP expiry job) are rewritten to post ledger entries. Existing accrual and consumption rows are backfilled into the ledger in the same migration so historical balances match to the cent, and a verification query is run after the migration comparing every current balance to its ledger-derived value.

## 7. Bind memberships, benefits, discounts and obligations to a specific pet

Right now all 9 memberships in the database have `pet_id` empty, and Direct Pay / Reserve are consumed per **user** (`consume_dp_for_ticket(_user_id, ...)`) — so a member with two pets shares one pool and plan caps cannot be enforced per pet, even though plans are priced per species.

Changes:

- Make `memberships.pet_id` required going forward and backfill existing rows (see Decisions below for what to do with members who have several pets).
- Add `pet_id` to accrual, hold and consumption paths: DP and Reserve accrue to the membership's pet, and a ticket may only draw from its own pet's balances.
- Checkout requires a pet selection; the Fear Free discount is derived from that pet's Vet of Record, not the user.
- Plan caps, DP window and max-DP are evaluated per pet-membership.
- BNPL obligations already carry `pet_id`; the multiplier and max-concurrent-obligation checks move to per-pet as well.
- UI: the plan checkout, wallet, payment plans and vet-ticket screens show which pet each benefit belongs to, and a member with several pets sees a per-pet breakdown.

## 8. Card settlement, expiry, refunds and disputes

Confirmed defect: the `vet_payout_status` enum allows only `pending, sent, completed, failed, reversed`, but `mark_ticket_settled` writes `'settled'` and both `expire-vet-card-auth` and the webhook write `'cancelled'`. Those writes fail at the database, so payouts stay stuck on `pending` after a card is actually used.

Fix:

- Extend the enum with `settled` and `cancelled` (and keep existing values), then correct every writer to use valid values.
- Complete the issuing lifecycle in the webhook: authorization request/created/updated, capture (`issuing_transaction.created`), partial capture, expiry with hold release, refund (`issuing_transaction` of type refund and `charge.refunded`), and dispute events (`issuing_dispute.*`, `charge.dispute.*`) — each posting the matching ledger entry (finalize, hold_release, reversal).
- Settle-under-approval already refunds unused Direct Pay; that logic moves onto the ledger as a `hold_release`, and settle-over-approval is recorded rather than silently ignored.
- All handlers are idempotent through the ledger's idempotency key, so Stripe retries are safe.

## Technical notes

- New table: `ledger_entries` with insert-only trigger, unique idempotency key, GRANTs for `authenticated` (read own rows via RLS) and `service_role`; balance views are security-invoker over the table.
- Rewritten DB functions: the six consume/release functions plus `mark_ticket_settled`.
- Edge functions touched: `stripe-webhook`, `compute-ticket-coverage`, `approve-vet-ticket`, `expire-vet-card-auth`, `process-dp-expiry`, `create-checkout`.
- Client: `plans-api.ts`, `bnpl-api.ts`, `reserve-history-api.ts` read balances from the views; wallet, plans, payment-plans and vet-ticket pages show per-pet context.
- Order of work: ledger schema and backfill → repoint functions to the ledger → per-pet binding → settlement/enum fix → reconciliation query proving old and new balances agree.

## Decisions needed

1. **Existing memberships with no pet:** attach each to the member's oldest pet, or leave them unassigned and require the member to pick a pet on next login before benefits accrue?
2. **Members with multiple pets today:** one membership per pet (each billed separately), or keep one membership and let the member nominate the covered pet?
