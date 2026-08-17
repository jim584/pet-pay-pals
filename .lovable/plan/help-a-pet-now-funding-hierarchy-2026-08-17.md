# Help a Pet Now Funding Hierarchy

Define one automatic funding order for every vet ticket, and turn any uncovered eligible amount into a Help a Pet Now fundraising campaign whose goal the system calculates.

## Funding order

At launch (Reserve Pool off):

```text
1. Direct Pay
2. BNPL
3. Help a Pet Now campaign for the remaining eligible amount
```

After the business enables Reserve Pool:

```text
1. Direct Pay
2. BNPL
3. Reserve Pool (only if the member/ticket qualifies)
4. Help a Pet Now campaign for the remaining eligible amount
```

If Reserve Pool is off, or the member is not eligible, the hierarchy skips it and goes straight to the campaign step.

Example: $20,000 estimate, $3,000 Direct Pay, $7,000 BNPL capacity leaves $10,000 uncovered, so the campaign goal is pre-filled at $10,000 — never the full $20,000.

## Reserve Pool feature flag

- A platform-level setting, default OFF, editable by an admin from the admin settings area — no code deploy needed to turn it on.
- While OFF: Reserve is excluded from coverage math, Reserve opt-in controls are hidden from members, and the coverage breakdown reports it as unavailable rather than "not eligible yet".
- No hard-coded date.

## Campaign creation flow

1. Ticket is submitted and coverage is computed.
2. If an eligible amount remains after Direct Pay and BNPL (and Reserve when enabled), the system creates a campaign record in `draft` with the goal pre-filled and locked to the calculated remaining amount.
3. The member is prompted on the ticket page to complete the required story and photo. Publish stays disabled until both are provided.
4. Once the member publishes, the campaign becomes visible in the Help a Pet Now feed.
5. Nothing is made public automatically; a draft campaign is only visible to its owner and admins.

Campaign card shows: goal, raised, remaining need, campaign status, verification status, and expiration status. Expiration/invoice/disbursement/priority rules are out of scope here — the fields exist so the later requirements can drive them.

## Technical notes

Database (one migration):
- `platform_settings` key/value table (or a `reserve_pool_enabled` flag row) — public read of the flag, admin-only write.
- `help_now_campaigns`: `ticket_id`, `pet_id`, `owner_id`, `goal_amount`, `raised_amount`, `status` (`draft`/`published`/`funded`/`expired`/`cancelled`), `verification_status`, `story`, `photo_urls`, `expires_at`, timestamps. Goal and raised are server-controlled via a guard trigger; the member may only edit story/photo and publish. RLS: owner + admin read on drafts, anon/authenticated read on published, admin full access, plus GRANTs.

Edge functions:
- `compute-ticket-coverage`: read the reserve flag; when off, force `reserve_use = 0`, `reserve_blocked_reason = "reserve_disabled"`, and add `help_now_needed` (the remaining eligible amount) to the breakdown.
- `submit-vet-ticket` / `approve-vet-ticket`: after coverage is stored, upsert the draft campaign with the computed goal; recompute the goal if coverage changes before publication.
- New `publish-help-now-campaign`: validates story + photo, flips status to `published`.

Frontend:
- `VetTicketsPage` coverage panel: add the "Help a Pet Now campaign" step to the funding waterfall with the calculated remaining amount and a "Complete your story to publish" call to action.
- New campaign composer (story + photos) reusing the existing story/photo upload components.
- Help a Pet Now feed renders published campaigns as fundraising cards with a progress bar.
- Hide Reserve opt-in UI wherever the flag is off; admin settings gains the toggle.
