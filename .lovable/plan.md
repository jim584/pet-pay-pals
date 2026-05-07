## Goal
Turn BNPL from an admin-only manual ledger into a self-serve installment product with: owner-facing portal, structured installment schedules, plan-driven capacity, automated default detection, and reminder emails.

---

## 1. Database changes (one migration)

**`bnpl_installments`** (new table)
- `id uuid pk`, `obligation_id uuid not null`, `seq int not null`
- `due_date date not null`, `amount numeric(10,2) not null`
- `paid_amount numeric(10,2) default 0`, `status text default 'scheduled'` (`scheduled | due | paid | missed`)
- `paid_at timestamptz`, `last_reminded_at timestamptz`
- `created_at`, unique `(obligation_id, seq)`

RLS: owner SELECT via obligation; admin ALL.

**`bnpl_obligations`** add columns
- `installment_count int not null default 4`
- `installment_interval_days int not null default 30`
- `next_due_date date`
- `last_payment_attempt_at timestamptz`
- `default_at timestamptz`
- `stripe_payment_intent_id text` (last manual pay attempt)

**`membership_plans`** add columns
- `bnpl_multiplier numeric default 0.5` (current placeholder value)
- `max_concurrent_obligations int default 3`
- `bnpl_default_installments int default 4`
- `bnpl_default_interval_days int default 30`

**Functions / triggers**
- `generate_bnpl_installments(obligation_id, count, interval_days, start_date)` — inserts equal installment rows, last absorbs rounding.
- Trigger on `bnpl_obligations` AFTER INSERT (when status moves to `pending`/`active`) → calls generator.
- Update `apply_bnpl_payment` trigger to also allocate the payment FIFO across `scheduled`/`due` installments, marking them `paid`, and update `next_due_date`.
- `mark_obligation_default(obligation_id)` SECURITY DEFINER helper used by cron.

---

## 2. Coverage logic (`compute-ticket-coverage` edge fn)

Replace the placeholder `eligibleTotal * 0.5` with:
- Read plan's `bnpl_multiplier` and `max_concurrent_obligations`.
- Count current pet's `pending|active` obligations; if `>= max_concurrent_obligations` → `bnplCapacity = 0`.
- Else `bnplCapacity = max(0, eligibleTotal * bnpl_multiplier - bnplOutstanding)`.
- Fallback to defaults (`0.5` / `3`) when no plan/membership.

`approve-vet-ticket` reads `installment_count` / `interval_days` from the plan when inserting the obligation.

---

## 3. Owner-facing Payment Plans page

**Route:** `/dashboard/payment-plans` (add to `App.tsx` and dashboard sidebar with `CreditCard` icon).

**New file:** `src/pages/PaymentPlansPage.tsx`
- Lists owner's `bnpl_obligations` (joined with ticket clinic + estimate) grouped by status: Active, Pending, Paid Off, Defaulted/Cancelled.
- Per obligation card: original amount, outstanding, next due date, progress bar, installment table (seq, due date, amount, status badge), "Pay now" button per installment + "Pay full balance".
- "Pay" opens Stripe Checkout via new edge fn `pay-bnpl-installment` (one-shot payment, no saved card requirement). Returns `url`, redirect.
- Stripe webhook adds a new branch for `kind=bnpl_payment`: inserts a `bnpl_payments` row (triggers recompute) and a `payment_history` row with `bnpl_obligation_id`.

**New API file:** `src/lib/bnpl-api.ts` — `listMyObligations`, `listInstallments`, `startBnplCheckout(installment_id | obligation_id, amount)`.

---

## 4. New / modified edge functions

- **`pay-bnpl-installment`** (new) — JWT-protected, validates owner, creates Stripe Checkout session with metadata `{ kind: "bnpl_payment", obligation_id, installment_id, user_id }`.
- **`stripe-webhook`** — add `bnpl_payment` branch (idempotent on PI), insert `bnpl_payments` row, link `payment_history`, fire reminder-cancel logic.
- **`process-bnpl-overdue`** (new, cron) — runs daily:
  1. Mark `scheduled` installments past `due_date` as `due`.
  2. Mark `due` installments past `due_date + grace (default 7d)` as `missed`.
  3. If an obligation has `>= 2` missed installments OR oldest missed `> 30 days` → call `mark_obligation_default`.
  4. Send reminders for installments due in 3 days, on due date, and on missed (each gated by `last_reminded_at`).
- **`send-bnpl-reminder`** (new) — invoked by `process-bnpl-overdue`. Renders a branded React-Email template (mirrors `auth-email-hook` style: same `SENDER_DOMAIN`, footer, etc.) and sends via `sendLovableEmail`. Templates: `_shared/email-templates/bnpl-upcoming.tsx`, `bnpl-due.tsx`, `bnpl-missed.tsx`, `bnpl-default.tsx`.

**Cron** registered via `cron.schedule` SQL (insert tool, with project URL + anon key) calling `process-bnpl-overdue` once daily at 13:00 UTC.

---

## 5. Admin updates

- `AdminPaymentPlansPage` shows installment schedule per obligation in the History dialog (read from new table) and a "Regenerate schedule" admin action.
- Add columns on the row: Next due, # missed.

---

## 6. Files touched

```text
supabase/migrations/<ts>_bnpl_installments_and_plan_fields.sql   (new)
supabase/functions/compute-ticket-coverage/index.ts              (edit)
supabase/functions/approve-vet-ticket/index.ts                   (edit)
supabase/functions/stripe-webhook/index.ts                       (edit: bnpl_payment branch)
supabase/functions/pay-bnpl-installment/index.ts                 (new)
supabase/functions/process-bnpl-overdue/index.ts                 (new, cron target)
supabase/functions/send-bnpl-reminder/index.ts                   (new)
supabase/functions/_shared/email-templates/bnpl-*.tsx            (4 new templates)
src/pages/PaymentPlansPage.tsx                                   (new)
src/lib/bnpl-api.ts                                              (new)
src/lib/admin-api.ts                                             (extend: installments fetch)
src/pages/admin/AdminPaymentPlansPage.tsx                        (extend)
src/components/dashboard/DashboardSidebar.tsx                    (add nav item)
src/App.tsx                                                      (add route)
```

---

## Notes / assumptions

- Default schedule on obligation creation: 4 installments × 30 days, configurable per plan.
- Payments are owner-initiated via Stripe Checkout (no saved-card auto-debit). Adding auto-debit later is possible without schema changes.
- Memory says BYOK Stripe is already wired (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in secrets) — I'll reuse it.
- Reminder emails reuse the existing branded Lovable email setup (`notify.plexaihub.com`); no new email infra needed.
- All amounts stay USD, two decimals.

Approve and I'll implement everything end-to-end (migration, edge functions, cron registration, UI, sidebar, route).