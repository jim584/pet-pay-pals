# Soft name matching (Phase 1)

Switch the verification policy so a valid, active license number with a **name mismatch** goes to `pending_review` instead of `unverified`. The license number still has to resolve to an active record — number-only isn't enough — but cosmetic name differences stop auto-rejecting vets.

## Behavior change

| Board response | Name check | New result | Old result |
|---|---|---|---|
| License found, Active, name matches | ✅ | `verified` | `verified` |
| License found, Active, **name differs** | ❌ | `pending_review` (surfaced to admin with mismatch details) | `unverified` |
| License found, Expired / Inactive / Revoked | any | `unverified` | `unverified` |
| License not found | — | `unverified` | `unverified` |
| Board unavailable / timeout / parse failure | — | `pending_review` | `pending_review` |

The fraud check is preserved: an admin sees exactly which name is on the license vs. what the applicant entered, and approves or rejects. Auto-approval only happens when both signals agree.

## Code changes

1. `supabase/functions/verify-vet-license/states/_generic.ts`
   - On active license + name mismatch, return `status: "ambiguous"` (already routes to `pending_review` in `index.ts`) instead of `status: "no_match"`.
   - Reason string: `"License is active for '<name on record>' but applicant entered '<expected>' — needs admin review."`
   - `decision.reason_code`: `name_mismatch_pending_review`, keeping `name_on_record` and `expected_name` for the admin drill-down.

2. `supabase/functions/verify-vet-license/states/common_test.ts` (and any adapter tests that assert `no_match` for a name mismatch case) — update expectations to `ambiguous` / `pending_review`.

3. Admin coverage drill-down already shows `status` + `reason` per attempt, so name-mismatch cases will appear with the mismatch reason without any UI change.

4. Nothing else moves. Number-not-found, expired, inactive, revoked all still resolve to `unverified` as before — same as your stated rule.

## Out of scope

- No change to the number-required rule (blank license number still → `pending_review` with `missing_input`).
- No change to circuit breaker, throttle, retry, feature flags, or fixture harness.
- No new DB columns — the mismatch details already live in `verification_raw.decision`.
