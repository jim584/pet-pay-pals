# Invoice-Based Help a Pet Now Campaign Rules

Once treatment is done and an actual vet invoice is accepted, the campaign leaves estimate rules: no 60-day deadline, and fundraising continues up to the verified veterinary amount that other funding sources haven't already covered.

## How it will work

**Admin accepts the invoice**
- The reviewer sees the invoice document and types the verified invoice total from it.
- On acceptance the campaign becomes invoice-based: the 60-day expiry is removed permanently, and the goal is recomputed as:
  `verified invoice total − Direct Pay used − BNPL financed − Reserve used`
- The recomputed goal is the hard ceiling. The campaign can never raise more than this, so no member is reimbursed twice for the same expense.
- Acceptance is rejected if the entered total is missing, zero, or negative, and the admin is warned before confirming when the new goal would fall below what the campaign has already raised.

**While the invoice-based campaign runs**
- No countdown, no expiry date shown; the badge reads "Invoice verified — no deadline".
- Progress is shown against the verified eligible amount.
- When raised reaches the ceiling the campaign flips to `funded` and stops accepting new funding for that expense.

**Over-raised campaigns**
- If the accepted invoice supports less than already raised, the campaign is closed to new donations immediately and flagged for admin follow-up on the surplus (a badge in the admin queue), rather than auto-refunding.

**Disbursement stays separate**
- Nothing in this change releases money to the member. Accepting an invoice only unlocks continued fundraising. UI copy on the member's campaign will state that funds are released only through payment to the vet or through the separate proof-of-payment process (defined in the next requirement).

**Rejected invoices** keep today's behaviour: the 60-day clock resumes with the review days credited back.

## Technical notes

Database migration on `help_now_campaigns`:
- `verified_amount numeric`, `verified_amount_source text`, `funding_offsets jsonb` (snapshot of DP/BNPL/Reserve at acceptance), `over_raised_flagged_at timestamptz`.
- Add the new columns to the member-edit guard trigger so only edge functions can set them.
- Add `help_now_campaigns_funding_cap` check enforced in a trigger: `raised_amount` may never exceed `goal_amount`; a campaign at the cap is forced to `funded`.

`review-campaign-invoice`:
- Accept `verified_amount` in the body; validate `> 0`.
- On accept: read the ticket's stored coverage breakdown for `dp_use`, `bnpl_use`, `reserve_use`, compute `goal_amount = max(0, verified_amount − offsets)`, clear `expires_at`, set `document_basis='invoice'`, persist the offsets snapshot, and set `status='funded'` plus `over_raised_flagged_at` when `raised_amount >= goal_amount`.

`compute-ticket-coverage`:
- Skip goal recomputation and expiry stamping for campaigns already `document_basis='invoice'`, so later coverage runs cannot resurrect a deadline or move the ceiling.

`expire-help-now-campaigns` sweep: already filters on estimate basis; add an explicit `document_basis='estimate'` guard so invoice-based campaigns can never be swept.

Shared cap helper `remainingEligibleAmount(campaign)` in `supabase/functions/_shared/`, plus `canDonateToCampaign` on the client returning false at the cap — this is the single gate the future donation/checkout path must call.

Frontend:
- `src/lib/help-now-campaigns-api.ts`: new fields, `campaignIsInvoiceBased`, `campaignRemainingEligible`, `reviewCampaignInvoice(id, 'accept', { verifiedAmount })`.
- `src/pages/admin/AdminCampaignInvoicesPage.tsx`: verified-amount input in the accept flow, computed-goal preview, over-raised warning, and an "Over-raised" filter/badge.
- `CampaignExpiryBadge`, `CampaignComposer`, `HelpNowCampaigns`: invoice-verified state with no countdown, progress against the verified amount, donate button disabled at the cap, and the disbursement disclaimer.

Then redeploy `review-campaign-invoice`, `compute-ticket-coverage`, and `expire-help-now-campaigns`.
