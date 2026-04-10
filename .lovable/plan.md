

## Plan: Together™ Membership Plans with Stripe Billing

This is a large feature spanning database design, Stripe payment integration, edge functions, and UI. It will be implemented in phases within one plan.

### Overview

Build a complete subscription system for pet health plans (Bronze/Silver/Gold/Platinum) with species-based pricing, Stripe Billing for recurring payments, fee splitting logic (70/20/10), Direct Pay accrual with rolling expiry, and expired DP redistribution (50/30/20).

---

### Phase 1: Stripe Setup

1. **Enable Stripe BYOK integration** using the `stripe--enable_stripe` tool, which will prompt you for your Stripe secret key.
2. **Store Stripe secret** as a project secret (`STRIPE_SECRET_KEY`).

---

### Phase 2: Database Schema (Migration)

Create the following tables:

**`membership_plans`** — Static reference table for the 8 plan variants:
- `id`, `plan_code` (e.g. `bronze_dog`), `tier_label` (e.g. `Together™ 10k`), `species` (dog/cat), `tier` (bronze/silver/gold/platinum)
- `membership_fee`, `platform_fee`, `direct_pay_portion`, `reserve_portion`, `admin_portion`
- `plan_cap` (nullable for Platinum), `dp_window_months` (nullable for Platinum), `max_dp_amount`
- `annual_price`, `fear_free_member_charge`, `stripe_price_id` (filled after Stripe product creation)
- RLS: public SELECT, admin-only INSERT/UPDATE/DELETE

**`memberships`** — Active user subscriptions:
- `id`, `user_id`, `pet_id` (FK to pets), `plan_id` (FK to membership_plans)
- `status` (active/cancelled/past_due/paused), `stripe_subscription_id`, `stripe_customer_id`
- `is_fear_free_member` (boolean for 5% discount), `started_at`, `cancelled_at`, `current_period_end`
- RLS: users see own, admins see all

**`direct_pay_accruals`** — Individual monthly DP rows for rolling expiry:
- `id`, `membership_id`, `accrual_month` (date), `amount`, `remaining_amount`
- `expires_at` (computed from plan window), `expired` (boolean), `expired_at`
- RLS: users see own via membership join, system-only INSERT/UPDATE

**`dp_expiry_ledger`** — Tracks redistribution of expired DP:
- `id`, `accrual_id`, `expired_amount`, `community_reserve_portion` (50%), `help_now_portion` (30%), `admin_portion` (20%)
- `help_now_case_id` (nullable FK), `created_at`
- RLS: admin-only SELECT

**`community_reserve`** — Running balance for ecosystem reserve:
- `id`, `balance`, `updated_at`
- RLS: admin-only

Also add `stripe_customer_id` column to `profiles` table.

---

### Phase 3: Edge Functions

**`create-checkout`** — Creates a Stripe Checkout Session:
- Accepts `plan_id`, `pet_id`, `is_annual`, `is_fear_free_member`
- Looks up plan, applies 5% Fear Free discount to membership component (not platform fee)
- Creates Stripe Customer if needed, stores `stripe_customer_id` on profile
- Creates Checkout Session with line items (membership + platform fee as separate items)
- Returns checkout URL

**`stripe-webhook`** — Handles Stripe webhook events:
- `checkout.session.completed` → Creates `memberships` row, starts DP accrual
- `invoice.paid` → Records monthly DP accrual row in `direct_pay_accruals` with correct 70/20/10 split
- `customer.subscription.updated` → Updates membership status
- `customer.subscription.deleted` → Marks membership cancelled, triggers DP expiry redistribution for remaining unused DP

**`process-dp-expiry`** (scheduled/cron) — Runs daily:
- Finds `direct_pay_accruals` rows past their `expires_at` where `expired = false`
- Marks them expired, creates `dp_expiry_ledger` entries with 50/30/20 split
- Credits Community Reserve and Help A Pet Now case

---

### Phase 4: Plan Selection UI

**New page: `/plans`** (or section within dashboard):
- Species selector (Dog / Cat)
- Tier cards (Bronze, Silver, Gold, Platinum) showing:
  - Friendly name (e.g. "Together™ 10k")
  - Monthly membership fee + platform fee
  - Plan cap, DP window
  - Annual subscription price
  - Fear Free member toggle with discounted price preview
- "Subscribe" button → calls `create-checkout` edge function → redirects to Stripe Checkout
- Route added to `App.tsx`

**Dashboard Wallet enhancement:**
- Show active plan name and status
- Show DP accrual balance with breakdown (available vs expiring soon)
- Show plan cap usage

---

### Phase 5: Seed Plan Data

Insert the 8 plan rows into `membership_plans` using the data from the provided table. Stripe product/price IDs will be created via the edge function or manually in the Stripe dashboard and stored back.

---

### Technical Details

**Fee split logic (per monthly payment):**
- Membership fee splits 70% Direct Pay / 10% Reserve / 20% Admin
- Platform fee is kept separate (not split)
- Fear Free 5% discount: applied only to membership component

**Rolling expiry example (Bronze Dog):**
- $42/mo membership → $29.40/mo Direct Pay accrual
- After 12 months, oldest month's unused DP expires first
- Expired $29.40 → $14.70 Community Reserve, $8.82 Help Now, $5.88 Admin

**Engineering separations per user's rules:**
- `plan_code` (engineering) vs `tier_label` (UX) stored separately
- DP window is per-plan, not hardcoded globally
- Platinum has null `dp_window_months` and null `plan_cap`

### Files Created/Modified
- `supabase/functions/create-checkout/index.ts` (new)
- `supabase/functions/stripe-webhook/index.ts` (new)
- `supabase/functions/process-dp-expiry/index.ts` (new)
- `src/pages/PlansPage.tsx` (new)
- `src/lib/plans-api.ts` (new)
- `src/components/plans/PlanCard.tsx` (new)
- `src/components/wallet/WalletView.tsx` (modified — show plan info)
- `src/App.tsx` (modified — add /plans route)
- `src/components/dashboard/DashboardSidebar.tsx` (modified — add Plans nav item)
- Database migration (5 new tables, 1 altered table)

