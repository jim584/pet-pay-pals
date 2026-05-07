
# Referral Program — Phase 2

Five additions on top of the existing admin-only referral system.

---

## 1. Public Referrer Dashboard

New route `/referrer` for users whose `auth.uid()` matches a row in `referrers.user_id`.

**Page sections:**
- Header: display name, type badge, referral code with copy button, share link `https://<site>/auth?ref=CODE`
- Stat cards: total referrals, active members, pending bounties ($), available bounties ($), lifetime paid ($)
- Tabs:
  - **Referrals** — list of own referrals (status, member name, activated date)
  - **Bounties** — own bounty rows (period, rate, amount, status, hold-until)
  - **Payouts** — own payout history
  - **Share** — large QR code + downloadable PNG + copyable link + social share buttons
- "Connect Stripe" button (see §3) if `payout_method != 'stripe_connect'`

**Access:** `RequireReferrer` guard — redirects to `/` with toast if user has no referrer row. Also surface a "Referrer Dashboard" link in the user dropdown when applicable.

**New file:** `src/pages/ReferrerDashboard.tsx`. Reuses existing `referrals-api.ts` with new self-scoped helpers (`getMyReferrer`, `listMyReferrals`, `listMyBounties`, `listMyPayouts`) — RLS already permits `user_id = auth.uid()` reads.

---

## 2. QR Code Generation

Add `qrcode.react` package. Render `<QRCodeCanvas value={shareUrl} size={256} />` in:
- Referrer dashboard "Share" tab (with PNG download)
- Admin Referrers table (modal "Show QR" action)

Download via canvas `.toDataURL("image/png")` → trigger `<a download>`.

---

## 3. Stripe Connect for Automated Payouts

**DB migration:**
- `referrers`: add `stripe_connect_account_id text`, `stripe_connect_status text default 'none'` (`none|pending|active|restricted`)
- `referrer_payouts`: add `stripe_transfer_id text`

**Edge functions** (3 new):
- `referrer-connect-onboard` — creates Stripe Express account if missing, returns Account Link URL for onboarding. Stores `stripe_connect_account_id`, sets status `pending`.
- `referrer-connect-status` — fetches account, updates `stripe_connect_status` to `active` when `charges_enabled && payouts_enabled`.
- `referrer-payout` — admin-triggered (`INTERNAL_FUNCTION_SECRET` or admin JWT). Sums `available` bounties for a referrer, creates a Stripe `transfer` to their connected account, inserts a `referrer_payouts` row with `method='stripe_connect'` + `stripe_transfer_id`, marks bounties `paid`.

**Webhook:** extend `stripe-webhook` to handle `account.updated` (sync connect status) and `transfer.paid` / `transfer.failed` (update payout row).

**Admin UI:** Referrers tab gets "Pay via Stripe" button (only when `stripe_connect_status='active'`); existing manual payout remains as fallback.

**Referrer UI:** "Connect Stripe" → `referrer-connect-onboard` → redirect to Stripe → return URL `/referrer?onboarded=1` triggers status refresh.

---

## 4. Shelter Milestone-Based Payouts

Shelters earn on adoption funding milestones, not subscription %.

**DB migration:**
- New table `shelter_referral_milestones`: `referrer_id`, `adoption_listing_id` (nullable), `pet_name`, `goal_amount`, `raised_amount default 0`, `status` (`open|completed|paid`), `payout_amount`, `completed_at`
- New table `shelter_milestone_contributions`: `milestone_id`, `payment_history_id` (nullable), `amount`, `source` (`donation|sponsorship|membership`), `created_at`
- DB function `record_milestone_contribution(_milestone_id, _amount, _source, _payment_history_id)` — increments `raised_amount`, sets `status='completed'` + `completed_at` when goal met, inserts `referral_bounties` row with `period='milestone'`, `bounty_amount = payout_amount`, `hold_until = now() + hold_days`
- Webhook hook: when a payment is tagged with `milestone_id` (passed via Stripe metadata), call the function

**Admin UI:** New "Milestones" tab inside `AdminReferralsPage` — create/edit milestones, link to shelter referrer, view contributions, mark manual contributions.

**Shelter referrer dashboard:** new "Milestones" tab showing their milestones with progress bars; the regular Bounties tab also shows `period='milestone'` rows.

The existing 5%/2% subscription logic in `stripe-webhook` is **skipped** for referrers of type `shelter` (they earn only via milestones).

---

## 5. End-to-End Testing

Live verification using Stripe **test mode** (existing `STRIPE_SECRET_KEY` test key).

**Test script** (`scripts/test-referral-flow.md` — checklist, not automated):
1. Admin creates a vet referrer (`fear_free_certified=true`) → copies code
2. Open incognito → visit `/auth?ref=CODE` → sign up new user → verify `referrals` row exists with `status=pending_signup`
3. New user subscribes to a membership via test card `4242…` → verify webhook creates `payment_history`, marks referral `active`, inserts `pending` bounty at 5%
4. Admin runs "Process holds" with `hold_days` temporarily set to 0 → bounty becomes `available`
5. Admin clicks "Pay via Stripe" (after referrer onboards Connect with test account) → verify `transfer` created, payout row inserted, bounty `paid`
6. Cancel subscription within hold window → verify bounty `reversed`
7. Vet with `fear_free_certified=false` → verify NO bounty inserted
8. Shelter milestone: create milestone, simulate contribution reaching goal → verify bounty + payout

**Tools used during execution:** `supabase--curl_edge_functions` for webhook simulation, `supabase--read_query` for state checks, `supabase--edge_function_logs` for debugging.

---

## Technical Details

**Files created:**
- `src/pages/ReferrerDashboard.tsx`
- `src/components/referrer/ReferrerGuard.tsx`
- `src/components/QRCodeCard.tsx`
- `supabase/functions/referrer-connect-onboard/index.ts`
- `supabase/functions/referrer-connect-status/index.ts`
- `supabase/functions/referrer-payout/index.ts`
- 2 migration files (Connect columns + shelter milestones)

**Files edited:**
- `src/App.tsx` (route)
- `src/lib/referrals-api.ts` (self-scoped helpers, milestone helpers, Connect helpers)
- `src/pages/admin/AdminReferralsPage.tsx` (Milestones tab, Pay-via-Stripe action, QR action)
- `supabase/functions/stripe-webhook/index.ts` (skip shelters in subscription path, handle milestone metadata, account.updated, transfer events)
- `package.json` (`qrcode.react`)

**Out of scope:** Referrer self-signup (admin still creates referrer rows); influencer landing pages; multi-currency payouts; Stripe Express dashboard embedding.
