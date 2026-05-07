# Plan A — Quick Wins

Ship the five low-risk fixes now. B (Vet of Record + Fear Free) and C (per-member Reserve) follow in separate passes once you confirm the Reserve eligibility rule (signup date / membership start / continuous-payment).

## 1. Enable ACH on Stripe Checkout
- File: `supabase/functions/create-checkout/index.ts`
- Add `us_bank_account` to `payment_method_types` alongside `card`.
- Add `payment_method_options.us_bank_account.verification_method = 'instant'` so Plaid-style instant verification is offered.
- No DB change.

## 2. Block plan checkout until a pet exists
- File: `src/pages/PlansPage.tsx` (and any "Choose plan" CTA on the membership flow).
- Before calling `create-checkout`, query `pets` for the current user. If zero pets → route to `/pets/new` with a toast: "Add your pet first — your membership is tied to a pet."
- Also guard server-side in `create-checkout`: reject with 400 if the user has no pet row.

## 3. Make pet photo required
- DB migration: `ALTER TABLE pets ALTER COLUMN photo_url SET NOT NULL;` — first backfill any existing nulls with a placeholder so the migration doesn't fail. (I'll check the count first and either backfill or set a sensible default.)
- UI: pet create/edit form — mark photo field required, disable Save until an image is uploaded/cropped.

## 4. Reword BNPL "reimbursement" → "repayment schedule"
- Search & replace user-facing copy in: BNPL components, plan/onboarding scripts, ticket coverage breakdown, any tooltip/help text.
- Keep DB column names as-is; only copy changes.

## 5. Remove email promises from onboarding
- Audit onboarding screens, plan confirmation, BNPL screens, vet-ticket success screens for any "we'll email you…" copy.
- Replace with in-app notification language ("You'll see this in your dashboard") until DNS verifies on `notify.plexaihub.com`.
- No functional change to the already-disabled email senders.

## What I will NOT touch in this pass
- Vet of Record / Fear Free verification (Plan B).
- Per-member Reserve balance, accruals, 12-month lock (Plan C).
- The 70/10/20 split itself — unchanged. Reserve allocation comes online in C.

## After A ships
I'll come back and ask you the Reserve eligibility question (signup date vs membership start vs continuous-payment) so B and C can be specced precisely.
