# 60-Day Rule for Estimate-Based Help a Pet Now Campaigns

Campaigns created from a veterinary estimate get a 60-day fundraising window. The member must supply the actual invoice within that window; if they don't, the campaign expires and donated funds are not released.

## Flow

```text
Estimate -> Campaign created (goal = uncovered eligible amount)
         -> expires 60 days after creation
         -> member uploads invoice  ......... clock pauses
              -> admin accepts  ............ campaign leaves estimate rules
              -> admin rejects  ............ clock resumes, review time not counted
         -> 60 days elapse, no accepted invoice -> Expired, donations closed
```

## What the member sees

- The campaign card and the ticket page show the expiration date and a days-remaining countdown ("Invoice needed by Oct 16 - 42 days left"), turning to a warning style in the final 7 days.
- Donations are accepted for the whole 60-day window. Reaching the goal is not required before uploading an invoice.
- An "Upload actual invoice" action on the member's campaign. After upload the card reads "Invoice under review - clock paused" and no days tick down.
- If an admin rejects the invoice, the member is told why, and the countdown resumes from where it stopped (the review days are added back).
- Once an admin accepts the invoice, the estimate countdown disappears; the campaign is marked invoice-backed and follows the separate invoice rules (not defined here).
- Expired campaigns stay visible in the Help a Pet Now feed with an "Expired - invoice not provided" badge and no donate button. Direct Pay and BNPL for that member/ticket are untouched.

## What admins get

An "Invoices awaiting review" queue in the admin area listing campaigns with a submitted invoice: view the document, Accept or Reject with a reason.

## Out of scope for this point

What happens to money raised on an expired campaign is handled by the separate redirected-donations requirement. No extra expiration periods and no automatic extensions beyond the pause described above.

## Technical details

**Database (migration on `help_now_campaigns`)**
- `document_basis text not null default 'estimate'` ('estimate' | 'invoice')
- `invoice_url text`, `invoice_status text not null default 'none'` ('none' | 'submitted' | 'accepted' | 'rejected'), `invoice_submitted_at timestamptz`, `invoice_reviewed_at timestamptz`, `invoice_reviewed_by uuid`, `invoice_rejection_reason text`
- `clock_paused_at timestamptz` - set when an invoice is submitted; on reject, `expires_at = expires_at + (now() - clock_paused_at)` and the field clears.
- Index on `(status, expires_at)` for the expiry sweep.
- Owner UPDATE policy tightened so members can change only story/photo/title fields; invoice status, basis, expiry and goal move through edge functions (service role), mirroring the existing guard-trigger pattern used on vet tickets.

**Campaign creation** - `compute-ticket-coverage` sets `expires_at = created_at + 60 days` and `document_basis = 'estimate'` when it first upserts the draft. Existing goal-sync behaviour is unchanged; expiry is set once and never recomputed.

**Edge functions**
- `submit-campaign-invoice` - member uploads the invoice file, function records `invoice_url`, sets `invoice_status='submitted'`, `clock_paused_at=now()`. Rejected if the campaign is already expired or already invoice-backed.
- `review-campaign-invoice` - admin only. Accept: `invoice_status='accepted'`, `document_basis='invoice'`, `verification_status='verified'`, `expires_at=null`, `clock_paused_at=null`. Reject: extends `expires_at` by the paused duration, stores the reason, clears the pause.
- `expire-help-now-campaigns` - daily sweep. Bounded batch (200 rows/run), single-flight lease row in `platform_settings`, idempotent (only flips rows still `published` with `expires_at < now()` and `clock_paused_at is null`) to `status='expired'`. Scheduled with pg_cron via `net.http_post` (run through the data tool, not a migration).

**Frontend**
- `src/lib/help-now-campaigns-api.ts` - extend the `HelpNowCampaign` type with the new fields; add `submitCampaignInvoice`, `reviewCampaignInvoice`, and a `campaignEffectiveStatus(c)` helper that treats a past-due published campaign as expired client-side (live check alongside the cron).
- New `CampaignExpiryBadge` component used by the campaign card in the Now feed and on `VetTicketsPage`.
- Donate action disabled wherever `campaignEffectiveStatus` returns `expired`.
- New admin section for the invoice review queue, following the existing admin page patterns.
