## Goals from the addendum

1. BNPL: when membership pauses/cancels, **pause the obligation entirely** — no auto-charges, no overdue/default escalation. Resume on reactivation.
2. Reserve: stop talking about each member's "reserve balance / lifetime accrued." Frame it as **shared community pool access** with eligibility and limits — not a personal ledger.
3. Vet tickets: **auto-approve under a dollar threshold** when attestation is attached, so members can use any clinic (Fear Free, Banfield, etc.) without admin review.
4. QR-code partner cards: out of scope for now.

## 1. Pause BNPL on membership pause/cancel

**Database (migration)**
- Add `paused boolean default false`, `paused_at timestamptz`, `paused_reason text` to `public.bnpl_obligations`.
- Add a SECURITY DEFINER function `public.sync_bnpl_paused_for_user(_user_id uuid)`:
  - If user has an `active`/`past_due` membership → set `paused=false`, `paused_reason=null` on all the user's `pending`/`active` obligations.
  - Else → set `paused=true`, `paused_at=now()`, `paused_reason='membership_inactive'` on `pending`/`active` obligations.
- Trigger on `public.memberships` AFTER INSERT/UPDATE OF status → calls the function with `NEW.user_id` (and `OLD.user_id` on update if different).

**Edge functions**
- `charge-bnpl-installment`: skip with `skipped: "obligation_paused"` when the obligation is `paused`. Also skip when the owner's latest membership is not `active`/`past_due` (belt-and-suspenders).
- `process-bnpl-overdue`: exclude paused obligations from the overdue/default sweep so paused balances don't trip the default timer.
- `pay-bnpl-installment` (manual): still allowed — the member can voluntarily pay down a paused obligation, but autopay won't fire.

**UI**
- `PaymentPlansPage`: show a "Paused — membership inactive" badge on paused obligations with a one-liner explaining auto-charges are stopped until membership reactivates. Hide the "Next due" date.
- `AdminMembershipsPage` pause/cancel confirm dialog: mention "Any active BNPL repayment plans for this member will be paused."

## 2. Reframe Reserve as a community pool (UI/copy)

No data deletion. The `member_reserve_accruals` table stays as the internal accounting ledger, but member-facing surfaces stop presenting it as personal money.

**Member-facing changes**
- `WalletView.tsx` "My Reserve" card → rename to **"Community Reserve Pool"**. Replace the three tiles (Reserve Balance / Lifetime Accrued / Used) with:
  - **Access status**: Eligible / Locked (12-month gate unchanged).
  - **Pool access this year**: amount drawn on the member's tickets year-to-date (and annual cap if their plan defines one).
  - **Last used**: date of last ticket the pool was drawn for, or "Not used yet."
- Helper copy:
  > "The Reserve is a shared community safety net funded by member contributions. Access is discretionary — it's only used after Direct Pay and BNPL on eligible tickets, while funds are available in the pool."
- `ReserveHistoryPage`: rename header to **"Community Reserve Pool — My Usage"**, subtitle "Times the community pool covered part of your vet ticket." Keep the rows; reword "Total Consumed" → "Total drawn for you."
- `VetTicketsPage` reserve opt-in card: change "Available: $X" (which today shows the user's per-user remaining) to **"Pool availability: $X"** and add tooltip: "Shared community funds. May change as other members use it."

**Admin-facing changes**
- `AdminReservePage`: rename "Member Reserve Accruals" → **"Member Contributions to Reserve Pool"** with subtitle "10% of each membership payment flows into the shared community pool." Rename "Member Reserve Consumptions" → **"Community Reserve Pool Draws"**.

**No business-logic changes** in this section. The FIFO `consume_reserve_for_ticket` still runs as the accounting mechanism — that's fine, it just isn't surfaced as "your balance" anywhere member-facing anymore.

## 3. Auto-approve vet tickets under a threshold

**Threshold source**
- Add `auto_approve_threshold numeric default 500` to `public.referral_program_settings` (already a singleton config table), or create a new `public.platform_settings` row. Simpler: reuse `referral_program_settings`. Configurable from the admin UI later; for now hard-coded default of $500.

**Edge function changes**
- New internal helper `auto-approve-vet-ticket` (or fold into `submit-vet-ticket`): after a ticket is inserted, if all of the following are true, immediately run the same approval logic the admin runs:
  1. `attestation_url` is non-null.
  2. `estimate_amount <= auto_approve_threshold`.
  3. The member has an `active`/`past_due` membership.
  4. Coverage (computed via `compute-ticket-coverage` with `use_reserve=false`) yields `dp_use + bnpl_use >= estimate_amount` (no reserve draw needed). If there's any remainder, it's still allowed — that just means the member pays the remainder to Help A Pet, as designed.
- On auto-approve, set `reviewed_by = NULL`, `admin_notes = 'auto-approved (under threshold + attestation present)'`, and skip the admin-only check in `approve-vet-ticket` for this code path (we'll factor the approval logic into an internal function callable with the service role).
- Anything failing the gates falls back to the current `submitted` → admin-review flow.

**UI**
- `VetTicketsPage` empty-state and submit flow: add helper text "Tickets with a vet attestation under $500 are approved automatically. Larger or missing-attestation tickets go to admin review."
- Admin queue (`AdminVetTicketsPage`) keeps the same review UI for the rest. Add a small "auto-approved" badge in any list that surfaces approved tickets so admins can see what was handled automatically.

## 4. QR-code partner cards

Out of scope. I'll add a note to project memory so future sessions know this is a planned-but-deferred feature, not something to remove or design around.

## Out of scope for this plan

- No changes to Stripe Issuing, member-remainder collection, donation splits, or DP accrual math.
- No removal of the `member_reserve_accruals` table or its FIFO consumption — only renaming/reframing on the surface.
- QR partner cards — flagged in memory as deferred.

Once approved I'll ship sections 1–3 in one pass: one migration (BNPL pause columns + trigger + settings field), edge function updates (`charge-bnpl-installment`, `process-bnpl-overdue`, `submit-vet-ticket` + a shared approval helper, plus internal-call permission in `approve-vet-ticket`), and the UI rename/copy changes across Wallet, Reserve history, Vet tickets, Payment plans, and Admin reserve/membership pages.
