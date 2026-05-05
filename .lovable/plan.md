## Stripe Issuing — Phase 3: merchant-locked vet cards

Wire Stripe Issuing into the existing vet ticket flow so that when a ticket reaches `funded`, we automatically provision a virtual card (and optionally a physical card) that is locked to the clinic, capped at the approved amount, and only valid for 6 hours.

### Prerequisite (must be confirmed before building)

Stripe Issuing must be activated on your Stripe account (Dashboard → Issuing → Get started). Until that's approved by Stripe, all Issuing API calls return 400. The build can ship behind a feature flag and stay dormant until Issuing is live — but no card will actually issue until you confirm activation.

If Issuing is not yet approved, I'll still build everything end-to-end and stub the actual `stripe.issuing.cards.create` call behind an `ISSUING_ENABLED` env flag so the rest of the flow (UI, webhooks, expiry job) is testable now.

---

### Database changes

**Extend `profiles`**: add `stripe_issuing_cardholder_id text` (cached per owner so we don't recreate cardholders).

**New table `issued_cards`**: persistent cards that survive across tickets (one physical + one virtual per owner).
- `id`, `owner_id`, `stripe_card_id`, `type` (`virtual | physical`), `last4`, `exp_month`, `exp_year`, `status` (`active | inactive | canceled`), `shipping_status` (for physical), `created_at`, `updated_at`.

**Extend `vet_tickets`**: already has `card_id`, `authorized_until`. Add:
- `issued_card_id uuid` (FK to `issued_cards`) — which physical/virtual card this ticket is bound to
- `merchant_lock_type text` (`merchant_id | mcc_only`) — records the trade-off when clinic merchant ID is unknown
- `last_authorization_id text` — most recent `iauth_...` for reconciliation

**New table `issuing_authorizations`**: append-only log of every Stripe `issuing_authorization.*` event for reconciliation and audit.
- `id`, `ticket_id`, `stripe_authorization_id`, `stripe_card_id`, `amount`, `merchant_id`, `merchant_category`, `status` (`pending | approved | declined | reversed | closed`), `decline_reason`, `payload jsonb`, `created_at`.

**New DB function `release_ticket_allocations` is already in place** — re-used by the expiry job to roll DP back when a card window expires unused.

**New DB function `mark_ticket_settled(_ticket_id, _settled_amount, _authorization_id)`**: in one transaction, sets ticket to `settled`, freezes spending limits to `0` on the card via a side-effect column flag, creates a `vet_payouts` row with `method='issued_card'`, and if `_settled_amount < approved_amount`, refunds the delta back to DP via `release_ticket_allocations` (partial — only the unused portion).

---

### Edge functions

**`issue-vet-card`** (called automatically by `stripe-webhook` when ticket transitions to `funded`, and also exposed for manual retry by admin)
1. Look up ticket; require `status = 'funded'` and no existing `card_id`.
2. Ensure `profiles.stripe_issuing_cardholder_id` exists; if not, create a Stripe Issuing Cardholder (`type=individual`, name from profile, billing address from profile or fall back to a configured business address).
3. Reuse owner's existing virtual card from `issued_cards` if one exists and is `active`; otherwise create a new virtual card via `stripe.issuing.cards.create({ type: 'virtual', cardholder, currency: 'usd', status: 'active' })`.
4. Apply per-ticket spending controls via `stripe.issuing.cards.update`:
   - `spending_controls.spending_limits = [{ amount: approved_amount_cents, interval: 'all_time' }]`
   - If `clinic_merchant_id` known → `spending_controls.allowed_merchants = [clinic_merchant_id]`, set `merchant_lock_type='merchant_id'`
   - Else → `spending_controls.allowed_categories = ['veterinary_services']` (MCC 0742), set `merchant_lock_type='mcc_only'` and record the looser-lock note in `admin_notes`
   - `metadata = { ticket_id, pet_id, owner_id, authorized_until }`
5. Persist `card_id`, `last4`, `exp`, `authorized_until = now() + 6h`, `issued_card_id`, `merchant_lock_type` on the ticket. Move ticket to `card_issued`.
6. Return non-sensitive card metadata. **PAN/CVC are never returned by this function** — the client fetches them separately using a Stripe ephemeral key (see UI section).

**`request-physical-vet-card`** (one-time, owner-initiated)
- Creates a physical card shipped to owner's address.
- Stored in `issued_cards`. Reused for all future tickets — same card, different spending controls per ticket.
- Owner UI shows shipping status (`pending`, `shipped`, `delivered`).

**`get-card-ephemeral-key`** (owner-only, called from card display screen)
- Verifies the caller owns the ticket / card.
- Calls `stripe.ephemeralKeys.create({ issuing_card: card_id }, { apiVersion })` and returns the key.
- Client uses this key with Stripe.js to render the actual PAN/CVC. Server never sees or logs them.

**`expire-vet-card-auth`** (cron, runs every 15 min)
- Find tickets where `status='card_issued'` and `authorized_until < now()` and no successful auth recorded.
- For each: update Stripe card spending limit to `[{ amount: 0, interval: 'all_time' }]` (neutralizes future charges without deleting the card).
- Set ticket status to `expired`, call `release_ticket_allocations(ticket_id)` to roll DP and BNPL allocations back.
- Cancel the related `vet_payouts` row.

**Extend `stripe-webhook`** (already exists) to handle Issuing events:

| Event | Handler |
|---|---|
| `issuing_authorization.request` | **Real-time approve/decline** — must respond in <2s. Look up ticket by `card.metadata.ticket_id`, verify `status='card_issued'`, `authorized_until > now()`, `amount ≤ approved_amount_cents`, and (if `merchant_lock_type='merchant_id'`) merchant matches. Approve or decline via response body. Log to `issuing_authorizations`. |
| `issuing_authorization.created` (approved) | Mark ticket awaiting settlement. Capture `merchant_id` from payload if we didn't have one — store on `vet_tickets.clinic_merchant_id` for future tickets to the same vet to enable tighter locks. |
| `issuing_authorization.updated` | Update auth status (e.g. reversed). |
| `issuing_transaction.created` | Final settlement. Call `mark_ticket_settled(ticket_id, settled_amount, authorization_id)`. Update card spending limit to `0` to freeze the card. |
| `issuing_card.updated` | Sync `status` and `shipping_status` into `issued_cards`. |

The webhook handler must dispatch on event type quickly — heavy work happens after the response for `issuing_authorization.request`.

---

### Auto-trigger from `funded` → `card_issued`

Currently the existing `stripe-webhook` flips a ticket to `funded` after the member-remainder Checkout completes. Extend that branch to also `await fetch(...)` the `issue-vet-card` function (or run the issuing logic inline). For tickets that are `funded` immediately at approval time (no member remainder), modify `approve-vet-ticket` to call `issue-vet-card` after the status flip.

Idempotency: `issue-vet-card` is a no-op if the ticket already has `card_id`.

---

### UI changes

**`/vet-tickets/:id/card` (new owner page)**
- Loads ticket, requires `status='card_issued'`.
- Countdown timer to `authorized_until` (turns red in last 30 min).
- Card display:
  - If owner has a physical card already, show "Use your physical card ending in ••XX at [Clinic]" plus the locked amount.
  - Always show a virtual card panel: calls `get-card-ephemeral-key`, then uses Stripe.js `IssuingCard` element to render the actual PAN + CVC (Stripe-hosted, never touches our server).
  - Apple Pay / Google Pay "Add to Wallet" button (Stripe Issuing supports push-provisioning via Stripe.js).
- Plain instructions: "Show this card to the clinic. They run it like a normal card."
- "Cancel ticket and refund my coverage" button — calls a cancel function that runs `release_ticket_allocations` and freezes the card.

**`/vet-tickets` (existing)**: add a "View card" button on rows where `status='card_issued'`.

**`/dashboard/profile` or `/wallet`**: add a "Order physical card" CTA (one-time) that calls `request-physical-vet-card` and shows shipping status.

**`/admin/vet-tickets` (existing)**: show card status, last authorization, settled amount, and a manual "Re-issue card" button for stuck tickets.

---

### Funding (admin-only, out of band)

Stripe Issuing cards spend from the Stripe Issuing balance, not the payments balance. You'll need to either:
- Enable automatic funding from your Stripe payments balance (Issuing settings), or
- Push funds from a connected bank account.

This is configured in the Stripe Dashboard, not in code. I'll add an admin doc note in `.lovable/plan.md`.

---

### Secrets / env

- `STRIPE_SECRET_KEY` — already present.
- `STRIPE_WEBHOOK_SECRET` — needed for Issuing webhook signature verification (same secret as the existing webhook if you're using one endpoint; or a separate one if you create a dedicated Issuing webhook in the Stripe Dashboard, which is recommended for the 2s latency budget).
- `ISSUING_ENABLED` — feature flag (`'true'` once Stripe approves Issuing on your account). When `false`, `issue-vet-card` returns a stubbed response and the ticket stays `funded` with a `manual_ach` payout row, matching today's behavior.
- `ISSUING_DEFAULT_AUTH_HOURS` — default `6`, overridable.
- `ISSUING_BUSINESS_ADDRESS_*` — fallback billing address for cardholder creation when owner profile is incomplete.

I'll request the missing ones via `add_secret` once you confirm.

---

### Webhook setup (manual step)

After deploy, you'll add a new Stripe webhook endpoint pointing at the existing `stripe-webhook` URL with these additional events selected:
- `issuing_authorization.request`
- `issuing_authorization.created`
- `issuing_authorization.updated`
- `issuing_transaction.created`
- `issuing_card.updated`

I'll surface the exact URL and event list in the chat after deploy.

---

### Out of scope for this pass (flagged as Phase 3.5)

- Real BNPL provider integration (Affirm/Klarna API). Still recorded as `manual` obligations.
- Reserve-pool eligibility rules (need Ryan's exact threshold definition).
- Receipt OCR on uploaded invoices.

Confirm and I'll build it. I'll surface the Stripe Issuing activation status and ask you to confirm `ISSUING_ENABLED=true` once Stripe approves the account.