## Goal
Stop letting "Sponsor" button write fake donations directly to the database. Route every donation through Stripe Checkout, and only record it after Stripe confirms the payment.

## Changes

### 1. New edge function `create-donation-checkout`
- Accepts `{ pet_id, amount, message?, donor_name?, donor_email? }`.
- Validates the pet exists and amount > 0.
- Resolves the current user (anonymous donations allowed — `user_id` is optional).
- Creates a Stripe Checkout Session in `mode: "payment"` with:
  - `line_items`: one custom price for the donation amount (USD).
  - `metadata`: `{ kind: "sponsorship_donation", pet_id, user_id, message, donor_name, donor_email }`.
  - `success_url`: `/help-overcome?donation=success`
  - `cancel_url`: `/help-overcome?donation=cancelled`
- Returns `{ url }`.

### 2. Extend `stripe-webhook` to handle `checkout.session.completed`
When `metadata.kind === "sponsorship_donation"` and `payment_status === "paid"`:
- Insert a row into `sponsorship_donations` (service role — trigger updates pet's raised total + status automatically).
- Insert a row into `payment_history` with `kind = "donation"` so it shows in admin revenue.
- Idempotent: skip if a `payment_history` row already exists for that `stripe_payment_intent_id`.

### 3. Update `HelpOvercomePage` SponsorDialog
- Remove the direct `submitDonation` call.
- On submit: call `create-donation-checkout` and `window.location.href = url`.
- On `/help-overcome?donation=success`: show "Thank you" toast and refetch sponsorship pets.
- On `?donation=cancelled`: show a neutral toast.

### 4. Lock down `sponsorship_donations` (migration)
- Drop policy "Users can insert own donations" — clients can no longer write donations directly.
- Keep SELECT policies. Service role (webhook) bypasses RLS.

### 5. Optional cleanup (only if you confirm)
- Reset existing test donation rows so the goal bars start at $0 raised:
  - `DELETE FROM sponsorship_donations;`
  - `UPDATE sponsorship_pets SET sponsorship_raised = 0, sponsorship_status = 'not_sponsored';`

I will skip step 5 unless you explicitly say "wipe test donations".

## Notes
- Uses the existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` already in the project — no new secrets needed.
- Uses the same idempotent select-then-insert pattern we applied to membership invoices.
- Anonymous donors are supported (no login required). When logged in, `user_id` is captured.
