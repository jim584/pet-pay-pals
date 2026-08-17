# Requirement 7: Preserve Existing Membership Referral/Bounty Program

## Current state (verified)

The Help a Pet membership referral/bounty program is already implemented and remains untouched by the recent Vetted affiliate compatibility work.

Existing components confirmed intact:
- `src/lib/referrals-api.ts` — core types and API for referrers, referrals, bounties, payouts, and shelter milestones.
- `src/pages/ReferrerDashboard.tsx` — referrer-facing dashboard.
- `src/pages/admin/AdminReferralsPage.tsx` — admin management surface.
- Database tables: `referrers`, `referrals`, `referral_bounties`, `referrer_payouts`, `referral_program_settings`, `shelter_referral_milestones`, `shelter_milestone_contributions`.

Recent Vetted affiliate work touched only:
- `vet_profiles` (added nullable `vetted_affiliate_id` / `vetted_affiliate_link`).
- `pets` (added nullable `vet_profile_id`).
- `src/components/vetted/ProductCard.tsx` (added optional `shopUrl` prop).
- `src/lib/vetted-affiliate.ts` (documentation stub).

There is no shared code, shared tables, or shared links between the two programs.

## Plan

No implementation changes are required for this requirement.

1. **Confirm separation in documentation**
   - Update `src/lib/vetted-affiliate.ts` stub to explicitly state that the future Vetted affiliate program is separate from the existing membership referral/bounty program and must not reuse referral links, bounty logic, or referrer records.

2. **No code changes to referral/bounty system**
   - Leave `src/lib/referrals-api.ts`, `ReferrerDashboard`, `AdminReferralsPage`, and all related database tables/functions unchanged.

3. **Future guardrail**
   - When the Vetted affiliate feature is eventually approved, any new attribution/click tables must be created independently and must not reference `referrals`, `referral_bounties`, or `referrers`.

## Acceptance criteria

- The existing membership referral/bounty program continues to function exactly as before.
- The Vetted affiliate compatibility work does not modify, merge with, or depend on referral/bounty tables or logic.
- Documentation clearly distinguishes the two programs.
