## Goal

Close the two remaining BNPL gaps:
1. **Auto-charge installments** off-session via Stripe SetupIntent + saved card (no manual click required).
2. **Repayment-history signal** in capacity (past defaults reduce the per-plan `bnpl_multiplier`).

---

## 1. Saved-card auto-charge

### Schema (migration)
Add to `profiles`:
- `default_payment_method_id text` — Stripe `pm_...` to charge off-session.

Add to `bnpl_installments`:
- `auto_charge_attempts int NOT NULL DEFAULT 0`
- `last_auto_charge_at timestamptz`
- `last_auto_charge_error text`

Add to `bnpl_obligations`:
- `auto_pay_enabled boolean NOT NULL DEFAULT true`

### New edge function: `setup-bnpl-autopay`
- Auth required. Creates a Stripe **SetupIntent** with `usage=off_session`, returns `client_secret`.
- After the user completes setup on the client, the resulting `payment_method` is attached to their customer and stored in `profiles.default_payment_method_id` (set as customer default).

### New edge function: `charge-bnpl-installment` (internal)
- Called by the cron processor for each due installment where `auto_pay_enabled` and a default PM exists.
- Creates a `PaymentIntent` with `confirm=true`, `off_session=true`, `customer`, `payment_method`, metadata `{ kind: "bnpl_payment", obligation_id, installment_id }`.
- On success: relies on existing `stripe-webhook` `payment_intent.succeeded` path (already records `bnpl_payments`).
- On failure (`authentication_required`, declined, etc.): increments `auto_charge_attempts`, stores `last_auto_charge_error`, falls back to a reminder email with a "Pay now" link to Checkout.

### Update `process-bnpl-overdue`
Before sending the "due" reminder, attempt auto-charge for installments where:
- `status = 'due'`, `due_date <= today`, `auto_charge_attempts < 3`,
- obligation `auto_pay_enabled = true`,
- profile has `default_payment_method_id`.

Only send the reminder email if auto-charge fails or no PM is on file.

Track in `bnpl_processor_runs`: add `auto_charges_attempted`, `auto_charges_succeeded`, `auto_charges_failed` columns + UI surfacing.

### Owner UI (`PaymentPlansPage.tsx`)
- Top of page: "Autopay" card showing current saved card (last4) or "Set up autopay" CTA → opens Stripe Elements (or hosted SetupIntent flow) to collect a card.
- Per-plan toggle: "Auto-pay this plan" bound to `bnpl_obligations.auto_pay_enabled`.
- Manual "Pay" buttons remain.

---

## 2. Repayment-history-aware capacity

### Schema (migration)
No new tables — derive from existing `bnpl_obligations.status = 'defaulted'` and `bnpl_installments.status = 'missed'`.

Add to `membership_plans`:
- `bnpl_default_penalty numeric NOT NULL DEFAULT 0.25` — fraction subtracted from `bnpl_multiplier` per prior default (capped).
- `bnpl_min_multiplier numeric NOT NULL DEFAULT 0.0` — floor.

### Update `compute-ticket-coverage`
Replace the flat multiplier line with:

```
priorDefaults = count(bnpl_obligations where owner_id=ticket.owner_id and status='defaulted')
recentMissed  = count(bnpl_installments where obligation.owner_id=owner and status='missed' in last 180d)
penalty = min(plan.bnpl_default_penalty * (priorDefaults + 0.5*recentMissed), plan.bnpl_multiplier)
effectiveMultiplier = max(plan.bnpl_min_multiplier, plan.bnpl_multiplier - penalty)
bnplCapacity = max(0, eligibleTotal * effectiveMultiplier - bnplOutstanding)
```

If `priorDefaults > 0` and `effectiveMultiplier == 0`, also force `bnplCapacity = 0` and surface `bnpl_blocked_reason: "prior_default"` in the breakdown.

Add the new fields to the returned `breakdown`:
- `bnpl_effective_multiplier`, `bnpl_prior_defaults`, `bnpl_recent_missed`, `bnpl_blocked_reason`.

### Admin UI (`AdminPaymentPlansPage.tsx` + `AdminPlansPage`)
- Plan editor: add inputs for `bnpl_default_penalty` and `bnpl_min_multiplier` next to existing `bnpl_multiplier` / `max_concurrent_obligations`.
- Owner row: show "Defaults: N" badge.

---

## Files to create
- `supabase/migrations/<ts>_bnpl_autopay_and_history.sql`
- `supabase/functions/setup-bnpl-autopay/index.ts`
- `supabase/functions/charge-bnpl-installment/index.ts`
- `src/components/payments/AutopaySetupCard.tsx`

## Files to edit
- `supabase/functions/compute-ticket-coverage/index.ts` — history-aware capacity.
- `supabase/functions/process-bnpl-overdue/index.ts` — try auto-charge before reminder; record stats.
- `supabase/functions/stripe-webhook/index.ts` — handle `setup_intent.succeeded` to persist default PM.
- `src/pages/PaymentPlansPage.tsx` — autopay card + per-plan toggle.
- `src/pages/admin/AdminPaymentPlansPage.tsx` — surface autopay/run stats + defaults badge.
- `src/lib/bnpl-api.ts` — `setupAutopay`, `toggleAutoPay` helpers.
- `src/integrations/supabase/types.ts` — auto-regenerated.

## Out of scope
- Multiple saved cards / card switching UI (single default PM only).
- SCA recovery flow beyond falling back to hosted Checkout.
- Configurable per-tenant penalty curves beyond the two new plan fields.
