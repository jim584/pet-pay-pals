# Plan: Addendum 2 — Automation, CMS, Fees, BNPL via Stripe, Reconsideration

## 1. Automated vet-ticket approval (expand existing $500 auto-approve)

Extend `submit-vet-ticket` and `referral_program_settings` to evaluate a full rules checklist before auto-approving. Manual admin review only fires when a check fails or a risk flag trips.

**Settings (new fields on `referral_program_settings`):**
- `auto_approve_ticket_threshold` (already exists, default $500)
- `excluded_procedures` (text[]) — keyword list matched against ticket description
- `risk_flag_thresholds` jsonb — `{tickets_per_30d, pets_added_per_7d, tickets_per_24h}`

**Auto-approve conditions (all must pass):**
1. Vet attestation present (file in `vet-tickets` bucket + `attestation_signed_at`)
2. Vet `is_approved = true` AND `is_license_verified = true` (good standing)
3. Procedure description does not match any `excluded_procedures` keyword
4. Estimate ≤ `auto_approve_threshold`
5. Member membership `active` or `past_due`
6. `compute-ticket-coverage` (use_reserve=false) yields full coverage
7. No risk flags: ticket count, recent pet adds, ticket velocity within thresholds

If any fail → route to admin queue with the failed-check reason recorded on the ticket (`auto_approval_blockers` text[]).

**Reserve-pool secondary review:** when a ticket is approved but `coverage_breakdown.reserve_use > 0` AND `bnpl_denied_all_providers = true`, set ticket to `awaiting_secondary_review` (new status). Admin must approve before reserve consumption commits.

## 2. Reconsideration request flow

New table `ticket_reconsideration_requests`:
- `ticket_id`, `requester_id`, `reason` text, `status` ('open'|'approved'|'denied'|'needs_info'), `admin_notes`, `resolved_by`, `resolved_at`

UI:
- Denied / reserve-denied tickets show a **"Request reconsideration"** button on `VetTicketsPage` and `ReserveHistoryPage` → modal with reason textarea
- `AdminVetTicketsPage` gets a **Reconsiderations** tab listing open requests with Approve/Deny/Request more info actions

Approve flips ticket back to `pending` and admin can then approve via existing flow.

## 3. Lightweight in-app CMS

New table `content_blocks`:
- `key` text unique (e.g. `landing.hero.title`, `membership.benefits`, `partner.fearfree.disclaimer`)
- `kind` ('text'|'richtext'|'image'|'image_list')
- `value_text` / `value_json` / `value_image_url`
- `updated_by`, `updated_at`

New role `content_editor` (added to `app_role` enum) so marketing team gets edit access without full admin.

Admin UI: `AdminContentPage` — searchable list of keys grouped by page, inline edit (text/richtext/image upload to existing `behave-media` bucket, drag-reorder for image lists).

Wire these surfaces to read from `content_blocks` with a `useContentBlock(key, fallback)` hook so existing copy stays as defaults if no row exists:
- Landing/marketing pages (hero, sections)
- Membership feature/benefit lists, pricing copy, partner-sensitive wording
- Rotating image carousels on home/landing

No external CMS dependency.

## 4. Fees & pricing display

**Membership pricing (UI only on `PlansPage` and membership marketing):**
- Base plan fee
- **Platform fee:** $10/month on monthly billing, $5/month on annual billing
- **5% transaction fee** shown on donation/payment breakdowns and ticket payment confirmations
- Show 70/20/10 allocation breakdown clearly

Add `platform_fee_monthly` / `platform_fee_annual` / `transaction_fee_pct` columns to `membership_plans` (defaults 10/5/0.05) so they're editable per plan. Charge logic in `create-checkout` adds the platform fee line item; donation/ticket flows surface the 5% fee in summaries.

## 5. BNPL via Stripe Checkout (Affirm/Klarna)

Confirm scope: we are **not** building custom Help A Pet financing. All "payment plans" come from Stripe Checkout with `payment_method_types: ['card','affirm','klarna']` (and `afterpay_clearpay` where eligible).

Changes:
- `pay-bnpl-installment` / new `create-bnpl-checkout` edge function creates a Stripe Checkout Session for the member's remainder with BNPL methods enabled; Stripe returns the real approved plans/terms at checkout — no plan calculation on our side.
- Remove internal "Help A Pet payment plan" copy from `PaymentPlansPage`; rename to "BNPL Plans (via Stripe)". Card shows: provider (filled in via webhook), term, monthly, status.
- `stripe-webhook` already handles checkout/invoice events — extend to record the chosen BNPL provider + plan onto `bnpl_obligations` from the session's `payment_method_options`.
- Keep existing pause-on-membership-inactive logic (Addendum 1) — when paused, our reimbursement charges stop but the member's obligation to the BNPL provider remains with Stripe.
- Before creating a new BNPL session, check `bnpl_obligations` for open obligations the user already has and surface them in the UI ("You have $X across N open plans currently being reimbursed").

Affirm/Klarna are enabled on the Stripe account by the user; no per-provider API integration on our side.

## 6. Out of scope this round
- QR partner cards (still deferred)
- Direct Affirm/Klarna API integrations (covered via Stripe)
- Donation-split math changes
- Velocity/abuse ML — we ship simple threshold flags only

## Technical sections

### Migrations
- `referral_program_settings` add `excluded_procedures text[] default '{}'`, `risk_flag_thresholds jsonb`
- `vet_tickets` add `auto_approval_blockers text[]`, status enum value `awaiting_secondary_review`
- `bnpl_obligations` add `provider text`, `plan_term_months int`, `stripe_checkout_session_id text`, `bnpl_denied_all_providers boolean default false`
- create `ticket_reconsideration_requests`, `content_blocks`
- add `content_editor` to `app_role`
- `membership_plans` add `platform_fee_monthly`, `platform_fee_annual`, `transaction_fee_pct`
- GRANTs + RLS per project convention

### Edge functions
- Update `submit-vet-ticket`: full auto-approve checklist + risk-flag query + blockers recording
- Update `approve-vet-ticket`: handle `awaiting_secondary_review` resolution
- New `create-bnpl-checkout`: builds Stripe Checkout session with `affirm`/`klarna`
- Update `stripe-webhook`: record provider/term on obligation; emit reconsideration events
- New `request-reconsideration`, `resolve-reconsideration`

### Frontend
- `AdminContentPage`, `useContentBlock` hook, image upload helper
- `AdminVetTicketsPage` — Reconsiderations tab, secondary-review badge
- `VetTicketsPage` / `ReserveHistoryPage` — reconsideration button + modal
- `PlansPage` and membership marketing — fee breakdown component
- `PaymentPlansPage` — "via Stripe BNPL" rename, existing-plan summary, new checkout button
