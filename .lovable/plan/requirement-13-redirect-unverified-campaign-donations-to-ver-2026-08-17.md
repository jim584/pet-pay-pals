# Requirement 13 — Redirect unverified campaign donations to verified cases

Donations to a Help a Pet Now campaign fund a verified veterinary expense. If an estimate-based campaign expires without the required invoice and proof of payment, its donations are never paid to that member — they move, under admin sign-off, to the oldest verified case that still needs funding, and every donor is told where their money went.

Note: campaign donations are not wired up yet — there is no donation checkout for a Help a Pet Now campaign and nothing currently records individual gifts. That intake is built here, because redirection can only track money it has a record of.

## What gets built

### 1. Campaign donations (new)
- A Donate action on a published campaign, capped at its remaining eligible amount.
- Stripe checkout for the donation; the campaign's raised amount only moves after the charge actually completes.
- Each gift is stored as its own record: donor, amount, campaign, date, and (later) where it was redirected.

### 2. Donor disclosure before paying
- The donate dialog states, before the donor confirms: the gift is intended for this campaign; if the campaign does not become a verified veterinary expense in time, the money is not paid as cash to the member and may be redirected to another high-priority verified case; redirection is not a refund.
- The same wording appears on the campaign card and in the receipt/confirmation.

### 3. Expiry creates a pending redirection
- When the nightly sweep expires an estimate campaign that holds donations, it creates a redirection batch in `pending` state instead of moving money.
- The batch proposes an allocation: oldest verified case first, each filled up to its remaining eligible need, continuing down the list until the amount is used up.
- "Verified case" means a published campaign with an accepted invoice and satisfied disbursement path (verified proof of payment, or direct vet payment), with remaining eligible need above zero.

### 4. Admin review and release
- New admin queue listing pending redirections: source campaign, amount held, and the proposed allocation with each receiving pet and amount.
- Admin can re-run the proposal (if cases changed), adjust which cases receive funds, and then Release.
- On release: the receiving campaigns' raised amounts increase, allocation rows are written with amount and date, and any unallocated remainder stays held and flagged rather than silently disappearing.

### 5. Donor notification
- After release, each donor of the source campaign gets an email naming the receiving pet(s) and linking to those campaigns, explaining that the original campaign did not meet verification.
- The same information shows in-app on the donor's donation record, and notification status is tracked per donor so nobody is emailed twice or missed.

### 6. Audit trail
Every donation permanently shows: original campaign, amount, whether that campaign verified or expired, receiving campaign(s), amount to each, redirection date, and donor-notification status.

## Priority order

The official Help a Pet Now hierarchy is defined separately and not invented here. Until it exists, the interim order is oldest verified case first. The ordering lives in one isolated function so the real hierarchy replaces it in one place without touching the redirection logic.

## Technical outline

- **Migration**: `campaign_donations` (donor, campaign, amount, stripe reference, status, redirection state, notification state); `campaign_redirections` (source campaign, total amount, status, released_at, released_by); `campaign_redirection_allocations` (redirection, receiving campaign, amount, created_at). Grants + RLS: donors read their own donations, admins read all, writes are service-role only via a guard trigger. Receiving campaigns' raised amount goes through the existing `enforce_help_now_funding_cap` trigger so a redirect can never overshoot a cap.
- **Edge functions**: `create-campaign-donation-checkout`; a `checkout.session.completed` branch in `stripe-webhook` that inserts the donation row and increments `raised_amount` idempotently; `_shared/redirection.ts` holding the eligible-case query and the ordering function; expiry sweep in `expire-help-now-campaigns` extended to open pending redirections; `release-campaign-redirection` (admin) to apply allocations and queue donor emails; donor email send through the existing transactional email path.
- **Frontend**: `DonateToCampaignDialog` with the disclosure; donation history entries showing redirection; `AdminCampaignRedirectionsPage` for review and release, linked from admin navigation.
- **Memory**: record the redirection rule and the interim ordering placeholder.
