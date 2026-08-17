# Requirement 12 — Invoice + Proof of Payment Before Disbursement

An accepted invoice alone will no longer make campaign funds eligible for release. A campaign becomes disbursement-eligible only through one of two verified paths.

## The two paths

```text
Path 1  Help a Pet pays the vet directly (card / vet payout)
        -> verified from the ticket's own payment record, or confirmed by an admin
        -> eligible for the direct-to-veterinarian payment process

Path 2  Member already paid the vet
        -> accepted invoice  AND  verified proof of payment (receipt)
        -> eligible for the member reimbursement process

Invoice only -> NOT eligible. Nothing is released.
```

## What members see

- The campaign panel gains a "Disbursement readiness" block with a two-step checklist: verified invoice, then proof of payment.
- Once the invoice is accepted, the member is asked which path applies. If Help a Pet is paying the vet directly, no receipt is requested and the panel says so. If they already paid, they upload a receipt/proof document.
- Proof of payment uploads go into review with clear status: submitted, verified, rejected (with reason), or flagged for review.
- Copy makes clear an unpaid invoice does not authorise release of funds.

## What admins see

- The existing campaign invoice review page gains a "Proof of payment" queue: view the invoice and receipt side by side, and mark the proof verified, rejected (reason required), or mismatched.
- A mismatch (receipt does not correspond to the same veterinary expense as the invoice) sets a review flag; it never auto-approves and never auto-rejects.
- Each campaign shows a plain readiness state: Not eligible / Eligible via direct vet payment / Eligible via verified reimbursement.
- No automatic amount thresholds or automated proof rules are introduced — verification is a human decision, recorded with who and when.

## Technical section

Database migration:
- New table `campaign_disbursement_documents` — campaign_id, ticket_id, uploaded_by, `doc_type` (`invoice` | `proof_of_payment`), storage path, `review_status` (`submitted`/`verified`/`rejected`/`flagged`), reviewer, reviewed_at, reason, notes, timestamps. Grants for authenticated + service_role; RLS: owner can read/insert own rows, admins full access. Invoice and proof are stored as separate records associated with the same ticket and campaign.
- `help_now_campaigns` gains: `disbursement_path` (`unset`/`direct_vet`/`member_reimbursement`), `proof_of_payment_status` (`none`/`submitted`/`verified`/`rejected`/`flagged`), `proof_of_payment_url`, `proof_submitted_at`, `proof_reviewed_at`, `proof_reviewed_by`, `proof_rejection_reason`, `disbursement_eligible_at`, `disbursement_block_reason`.
- Extend `guard_help_now_campaign_fields` so members cannot self-set proof status, eligibility, or path verification fields.
- Backfill: existing accepted-invoice campaigns get `disbursement_path = 'unset'`, `disbursement_eligible_at = null` (i.e. explicitly not yet eligible).

Edge functions:
- `submit-campaign-proof` — member uploads proof against an invoice-backed campaign; writes a `proof_of_payment` document row and sets status `submitted`. Rejects when no accepted invoice exists.
- `review-campaign-proof` — admin only; `verify` / `reject` / `flag`. On `verify` sets `proof_of_payment_status = verified`, `disbursement_path = member_reimbursement`, stamps `disbursement_eligible_at`.
- `compute-disbursement-eligibility` (shared helper in `_shared/disbursement.ts`, called from the two functions above and from the vet-payout/settlement path): eligible when either (a) the ticket has a settled direct vet payment (`vet_payouts` settled / issued-card settlement on the ticket) → `direct_vet`, or (b) accepted invoice + verified proof → `member_reimbursement`. Otherwise clears eligibility with a reason.
- `review-campaign-invoice` keeps accepting the invoice and setting the verified goal, but no longer implies disbursement eligibility; it calls the shared helper.

Frontend:
- `src/lib/help-now-campaigns-api.ts`: new types and helpers `campaignDisbursementState()`, `campaignProofRequired()`, plus `uploadCampaignProof`, `submitCampaignProof`, `reviewCampaignProof`, `listCampaignsAwaitingProofReview`.
- `src/components/help-now/CampaignInvoicePanel.tsx`: readiness checklist, path selection, proof upload, status copy.
- New `src/components/help-now/DisbursementReadinessBadge.tsx` used in the panel and admin lists.
- `src/pages/admin/AdminCampaignInvoicesPage.tsx`: add the proof-of-payment review queue and mismatch flagging.

Out of scope here (handled by their own requirements): when donations become available, ledger balances, withdrawal timing, fees, and campaign updates.
