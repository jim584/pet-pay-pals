## Goal
Add a Referral & Bounty Program: each eligible referrer (vet, shelter, influencer, partner) gets a unique referral code/link. New members signing up via that link have the referrer credited. Bounties accrue per paid invoice (5% first 6 months, 2% ongoing), are held 30 days, then become payable. Cancellations within 30 days reverse pending bounties. Vets must be Fear Free certified to participate.

## Database (migration)

**Enum**
- `referrer_type`: `vet | shelter | influencer | partner`

**`referrers`**
- `id uuid pk`, `user_id uuid` (nullable — partner may be off-platform), `type referrer_type`, `display_name text`, `code text unique` (short slug), `is_active bool default true`, `fear_free_certified bool default false` (vets only — required to be true to earn), `payout_email text`, `payout_method text default 'manual'`, `notes text`, `created_at`, `updated_at`
- Auto-generated `code` via trigger if blank (8-char random).

**`referral_program_settings`** (singleton row)
- `intro_rate numeric default 0.05`, `intro_months int default 6`, `ongoing_rate numeric default 0.02`, `hold_days int default 30`. Admin-editable.

**`referrals`** (link a member → referrer)
- `id`, `referrer_id fk referrers`, `referred_user_id uuid` (the member), `membership_id uuid` (set when first paid membership activates), `code_used text`, `status text` (`pending_signup | active | reversed | inactive`), `activated_at`, `created_at`, `unique(referred_user_id)` — a member is referred by at most one referrer.

**`referral_bounties`** (one row per qualifying paid invoice)
- `id`, `referral_id`, `referrer_id`, `payment_history_id` (fk), `membership_id`, `period text` (`intro|ongoing`), `rate numeric`, `gross_membership_amount numeric`, `bounty_amount numeric`, `hold_until timestamptz`, `status text` (`pending | available | paid | reversed`), `paid_at`, `payout_id fk referrer_payouts nullable`, `created_at`.

**`referrer_payouts`**
- `id`, `referrer_id`, `amount`, `method`, `status` (`pending|paid|failed`), `external_ref`, `notes`, `created_at`, `paid_at`.

**RLS**
- All admin-managed (existing `has_role(...,'admin')` pattern).
- Referrers can `SELECT` their own row, their `referrals`, their `referral_bounties`, and their `referrer_payouts` (via `user_id = auth.uid()`).
- Public/anon `SELECT` on `referrers` limited to `code, display_name, type, is_active` for code-validation on signup (or use a `SECURITY DEFINER` function `public.resolve_referral_code(_code text)` returning minimal info — preferred).

## Tracking flow

1. **Capture code** — `Auth.tsx` reads `?ref=CODE` from URL on mount; if present and valid (call `resolve_referral_code`), persist to `localStorage.pending_referral_code`.
2. **On signup completion** — after `signUp()` returns user, if a code is stored, insert a `referrals` row `(referrer_id, referred_user_id=user.id, code_used, status='pending_signup')`. Clear localStorage. Done client-side using a permissive INSERT policy: `auth.uid() = referred_user_id AND NOT EXISTS prior referral for this user`.
3. **Activation & accrual** — extend `supabase/functions/stripe-webhook/index.ts` `invoice.payment_succeeded` handler:
   - After inserting `payment_history` row for a `membership_invoice` paid invoice, look up `referrals` for `referred_user_id = membership.user_id`.
   - If found and `status in ('pending_signup','active')`:
     - On first paid invoice: set `referrals.status='active'`, `activated_at=now`, `membership_id`.
     - Compute months elapsed since `activated_at`. If `< intro_months` → `intro` rate, else `ongoing` rate.
     - If referrer is `vet` and `fear_free_certified=false` → skip bounty (still mark referral active).
     - Insert `referral_bounties` row with `bounty_amount = round(amount * rate, 2)`, `hold_until = now + hold_days`, `status='pending'`.
4. **Hold expiry** — add edge function `process-referral-bounties` (manually invokable + cron-eligible later):
   - Move `pending` bounties whose `hold_until <= now()` to `available`.
5. **Cancellation reversal** — extend webhook `customer.subscription.deleted` / `invoice.payment_failed`:
   - If a referred membership is cancelled and `now() < activated_at + 30 days`, set all bounties for that referral to `reversed` and set `referrals.status='reversed'`.

## Admin UI

**`/admin/referrals`** new page (sidebar item "Referrals" with `Megaphone` icon, between Payment Plans and Wallet & Reserve).

Tabs:
- **Referrers** — table (Name, Type, Code, FF Certified, Active, Outstanding bounty, Lifetime paid, Created). Actions: create, edit, toggle active, copy referral link `${origin}/auth?ref=CODE`. Vets: toggle FF certified.
- **Referrals** — table of referred members (Member name, Referrer, Code, Status, Activated, Membership). Filters by status.
- **Bounties** — table (Date, Referrer, Member, Period, Rate, Membership amount, Bounty, Hold until, Status). Filter by status; "Run hold-expiry job" button → `process-referral-bounties`.
- **Payouts** — table + "Create payout" dialog: select referrer, sums `available` bounty amount, on confirm inserts `referrer_payouts` row and links those bounties (`status='paid'`, `payout_id`, `paid_at`). Mark payout status `paid` with optional external ref.
- **Settings card** — edit `referral_program_settings` (rates, intro months, hold days).

**`/admin/vets/:id`** — show "Fear Free certified for bounty" toggle that updates the referrer record (creating one if vet has no referrer yet).

## Public/referrer surface (minimal in this phase)

- **Signup capture only** — `?ref=CODE` honored on `/auth`. Show a small "Referred by {display_name}" badge on the auth card if code resolves.
- A self-serve referrer dashboard is **out of scope** for this phase; admins manage referrer accounts and share links manually. (Easy follow-up.)

## API layer

**`src/lib/referrals-api.ts`** (new)
- `resolveReferralCode(code)` → calls SECURITY DEFINER fn
- `attachReferralOnSignup(userId, code)`
- Admin: `listReferrers`, `createReferrer`, `updateReferrer`, `listReferrals(filter)`, `listBounties(filter)`, `runReferralHoldJob()`, `listPayouts`, `createPayout(referrerId)`, `updatePayoutStatus`, `getSettings`, `updateSettings`.

## Edge functions

- `process-referral-bounties` (new) — promote pending → available; admin-only auth via service role check + admin role.
- `stripe-webhook` (modified) — referral accrual on paid invoice; reversal on early cancellation.

## Out of scope (this phase)
- Self-serve referrer signup, referrer-facing dashboard.
- Stripe Connect automatic payouts (payouts recorded as manual; external_ref captured).
- QR code rendering (the link is enough; a QR can be added later via a small `qrcode.react` install).
- Multi-tier / shelter milestone-funding-based payouts (handled with manual payouts for now; the admin can create payouts arbitrarily).