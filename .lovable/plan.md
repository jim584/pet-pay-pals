# Harden CA adapter with real fixture (license #24766, Johnny H Nguyen)

## Steps

1. **Fetch live CA DCA response** (read-only, one request) for License Type = "Veterinarian", License Number = `24766`, using the same POST the adapter uses. Confirm HTTP 200 and that the response contains "NGUYEN, JOHNNY H" (or similar) and a status like "Clear" / "Current" / "License Renewed & Current".

2. **Run adapter against the live response once** to confirm end-to-end `match`. If it doesn't classify correctly, patch:
   - `ca.ts` attempt URL / POST body if needed
   - `common.ts` `classifyStatus` regex to include any missing DCA-specific keyword
   - `common.ts` name extraction so `NGUYEN, JOHNNY H` normalizes and matches `Johnny H Nguyen`

3. **Capture strictly-minimal sanitized fixture** at `supabase/functions/verify-vet-license/states/__fixtures__/ca-active.html`:
   - **Keep only these five fields:** licensee name, license number, license type, status, expiration date.
   - **Strip everything else**, including but not limited to: street address, city, county, ZIP, phone, email, secondary licensees, issue date, board actions/discipline history, script/style blocks, tracking pixels, cookies, session tokens, all HTTP request/response headers, `__VIEWSTATE`, and any hidden form fields.
   - Reduce the DOM to a tiny HTML skeleton that still parses through the adapter's `stripTags` path — just enough markup to hold the five fields in the same order the live page uses.
   - Replace the placeholder `ca-active.example.html` with this real fixture and delete the placeholder.

4. **Add two more fixtures with the same five-field-only rule**:
   - `ca-notfound.html` — response body for a license number that returns no results (e.g. `99999999`). Body contains no PII at all (DCA's "no records found" message is already field-free). Expected adapter result: `unverified` (no_match).
   - `ca-expired.html` — response for a license the DCA marks as "Delinquent" or "Cancelled". Same five-field-only rule (name, license #, license type, status, expiration date). Expected: `expired` / `inactive` → `unverified`. If no clean public example is available, skip and note it in the coverage doc; expired classification is already covered by `common_test.ts`.

5. **Write fixture tests** in `adapters_test.ts`:
   - `CA active license 24766 → match` — real fixture, asserts `status: "match"` and name-on-record includes "NGUYEN".
   - `CA nonexistent license → unverified`.
   - `CA expired license → expired/inactive` (only if fixture #4 was captured).
   - Each test wrapped in `withFixture(...)`; no live network access.

6. **Run the Deno test suite** (`supabase--test_edge_functions` on `verify-vet-license`) and confirm the three (or two) new tests pass, plus `common_test.ts`, `unavailable_test.ts`, `fixtures_pii_test.ts`.

7. **Mark CA as validated** in `.lovable/plan.md` Phase 1 checklist and leave the CA feature flag enabled. Do not touch TX / FL / NY / PA / IL / OH / GA / NC until you send their test data.

## Guardrails

- Only one live request per fixture capture. No looping.
- User-Agent stays as `HelpAPet-VerificationBot/1.0 (+contact url)`.
- Every fixture passes the existing `fixtures_pii_test.ts` PII lint (SSN, DOB, email, phone, cookie, auth-header patterns fail the build). I'll extend that lint before capture to also fail on a street-address regex (`\d+\s+[A-Z][a-z]+.*\b(St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Pl)\b`) and on a bare 5-digit ZIP, so the "five fields only" rule is enforced automatically.
- If the live fetch returns 403 / captcha / anti-bot, I'll stop, report back, and we'll decide whether CA needs Browserless. I won't hand-write a synthetic "success" fixture.

## What I'll report back after the run

- Live HTTP status and content-type.
- Which status keyword DCA used for this license.
- The parsed `licensee_name`, `license_status_text`, expiration date.
- Final test-suite output.
- Diff of any classifier / name-extraction tweaks that were needed.
