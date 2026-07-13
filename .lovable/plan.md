## Phase 1 Rollout & Testing Plan

Consolidated brief covering the four items you asked for, plus the acceptance checklist that maps 1:1 to your nine requirements. No code changes proposed here — this is the plan we execute once test-license data arrives.

---

### 1. Exact Phase 1 state list (9 states)

MI was dropped per the earlier robots.txt review. Final Phase 1 adapters currently registered:

| # | Code | State | Board | Endpoint technique | Browserless likely? |
|---|---|---|---|---|---|
| 1 | CA | California | DCA / Veterinary Medical Board | JSON via `search.dca.ca.gov` | No |
| 2 | TX | Texas | TBVME | JSON via `vetlicensesearch.tbvme.texas.gov` | No |
| 3 | FL | Florida | DOH MQA | HTML POST form | No |
| 4 | NY | New York | NYSED Office of the Professions | SPA + XHR | **Yes (likely)** |
| 5 | PA | Pennsylvania | PALS | JSON via `pals.pa.gov` + Cloudflare | **Maybe** (Cloudflare-dependent) |
| 6 | IL | Illinois | IDFPR eLicense | ASP.NET WebForms w/ viewstate | Possibly |
| 7 | OH | Ohio | eLicense Ohio | GET w/ query param | No |
| 8 | GA | Georgia | SOS verification portal | GET w/ query param | No |
| 9 | NC | North Carolina | NC Vet Medical Board (Thentia SPA) | SPA + session-token JSON | **Yes (likely)** |

Coverage: ~48% of US practicing vets. All others (41 + DC) remain `manual review` with a deep-link to the correct board.

---

### 2. Browserless-required state list (from Phase 1)

**Confirmed candidates:** NY, NC. Their public search pages don't return usable HTML to a plain `fetch` — the licensee list is hydrated by JS after the SPA loads.

**Conditional candidates:** PA (Cloudflare may 403 server-to-server calls intermittently), IL (ASP.NET viewstate can be reproduced with `fetch` but is brittle).

**Confirmed NOT needed:** CA, TX, FL, OH, GA. All expose stable HTTP endpoints.

**We won't wire Browserless until:**
1. You've reviewed the Section-2 write-up from the previous turn (usage / cost / data / retention / self-host).
2. A real Phase 1 test proves plain `fetch` truly fails for NY / NC (not just a wrong selector on my part).

---

### 3. License-test fields required per state

Send publicly-available examples only (Fear Free directory, board's own public roster, or with the practitioner's explicit consent). Sanitize before pasting anything into chat.

Universal fields per test case:

| Field | Required |
|---|---|
| `state_code` | yes |
| `full_legal_name` | yes — as printed on the license |
| `license_number` | yes — verbatim, including leading zeros |
| `license_type` | see per-state notes |
| `expected_status` | yes — `active` / `expired` / `inactive` / `suspended` |
| `expiration_date` | optional but preferred |
| `source_url` | optional — direct link to the board's listing if you have one |

Per-state notes:

- **CA** — no license-type field needed. VMB issues one code.
- **TX** — license type `Veterinarian`. Skip `LVT` / `Equine Dental Provider`.
- **FL** — license type `Veterinarian` (`VM` prefix). Skip `Faculty Certificate`.
- **NY** — profession code `63`. No type field.
- **PA** — license type `Veterinarian`. Skip `Veterinary Technician`.
- **IL** — license type `Veterinarian` (090). Skip `Vet Tech` (095).
- **OH** — license type `Veterinarian`.
- **GA** — board code `045`. No type field.
- **NC** — license type `Veterinarian`. Skip `Vet Technician` / `Faculty License`.

**Per state, ideally three cases:**
1. Active/current license → adapter must return `match`.
2. Expired or inactive license → adapter must return `expired` or `inactive` (never `match`).
3. Nonexistent license number (e.g. `99999999`) → adapter must return `no_match` or `source_unavailable`, never `match`.

Suspended/revoked cases are best-effort — many boards don't publicly list them.

---

### 4. Phase 1 testing checklist (maps 1:1 to your 9 requirements)

Per state, we don't mark the adapter "green" until every box below is checked.

| # | Your requirement | How we validate |
|---|---|---|
| 1 | Verify each adapter against a known-valid license | Live call to the real board using your test license → adapter returns `status: "match"` with the correct name-on-record. Response captured as fixture. |
| 2 | Test invalid and nonexistent license numbers | Fixture test with a bogus number → adapter returns `no_match`. Live smoke-test once with an obviously invalid number. |
| 3 | Test expired / suspended / inactive licenses where available | Fixture test per case using your example → adapter returns `expired` / `inactive` (not `match`). Case is skipped only if the board doesn't publicly list any such record. |
| 4 | Confirm name matching behavior | Unit tests in `states/common_test.ts` (new file) covering: exact match, "Last, First" swap, diacritic strip, nickname (Bob→Robert), Levenshtein ≤ 2, and a deliberate mismatch that returns `no_match`. |
| 5 | Confirm rate-limit and timeout handling | Add per-state in-memory throttle (1 req/sec/board) to `_generic.ts`. Test: simulate 5 rapid calls, verify they serialize. Timeout test: mock 20s fetch → adapter returns `source_unavailable`. |
| 6 | Confirm unavailable sources return `pending_review`, not `unverified` | Existing behavior in `verify-vet-license/index.ts` already maps `source_unavailable` → `pending_review`. Add explicit test that exercises the full function with a stubbed 503 response. |
| 7 | Audit logs showing which source was checked and why | Every attempt already writes to `vet_verification_attempts` (source, status, http_status, error, payload). We'll extend the payload with a `decision` field: `{ reason_code, matched_by, name_on_record, snippet }` so admins can see exactly why. |
| 8 | Feature flags to disable individual state adapters | New table `verification_state_flags(state_code PK, enabled bool, disabled_reason text, updated_at)`. `verify-vet-license` checks the flag before dispatching; disabled → immediate `pending_review` with reason. Toggle from the coverage page. |
| 9 | No vet rejected solely because a licensing website is unavailable | Already enforced by the `source_unavailable` → `pending_review` mapping + hourly cron retry (max 72h). Adding two guardrails: (a) admin dashboard alert if a state has ≥3 consecutive failures, (b) new profile status is only set to `unverified` when the board explicitly returns "no such license" or "expired/revoked" — never on network / parse errors. |

---

### 5. Rollout order (Phase 1 only)

Work state-by-state in this order so early wins land first and Browserless-dependent states come last:

1. **CA** (stable JSON) — validate + fixture + tests.
2. **TX** (stable JSON) — same.
3. **OH** (simple GET) — same.
4. **GA** (simple GET) — same.
5. **FL** (POST form) — same.
6. **PA** — try plain `fetch` first; if Cloudflare blocks, note it and defer to Browserless decision.
7. **IL** — attempt viewstate reproduction with `fetch`; if brittle, defer to Browserless.
8. **NY** — validate that plain `fetch` truly fails, then defer to Browserless decision.
9. **NC** — same as NY.

After steps 1–5 are green we have ~5 states shipping in production and the remainder waiting on the Browserless review.

---

### 6. What I will do once you approve

**Immediately (no new dependencies):**
1. Create `verification_state_flags` table + admin toggle UI on the coverage page (fulfills requirement #8).
2. Add per-state throttle (1 req/s) and 15s timeout guard in `_generic.ts` (fulfills #5).
3. Extend `vet_verification_attempts.payload` with the structured `decision` object (fulfills #7).
4. Add `states/common_test.ts` name-matching unit tests (fulfills #4).
5. Add `verify-vet-license/index_test.ts` covering the 503 → `pending_review` path (fulfills #6, #9).
6. Add a "≥3 consecutive failures" alert card to the coverage page (fulfills #9 guardrail).

**Per state, once you send test licenses (in the order above):**
7. Live-call the board, tune selectors/regex, capture sanitized fixture, write fixture-driven test (fulfills #1, #2, #3).
8. Mark the state green in the coverage page.

**After all 9 states validated:**
9. Return with a concrete Browserless-or-self-host recommendation scoped only to states that provably need it.

---

### Open questions before I start building

1. **Verification state flags table** — okay to create it now (small, admin-only), or do you want to review the schema first? Proposed columns: `state_code text PK`, `enabled boolean default true`, `disabled_reason text`, `updated_at timestamptz`, `updated_by uuid`.
2. **"Consecutive failures" threshold** — 3 is my proposal. Higher (say, 10) reduces false alarms on low-volume states. Preference?
3. **Test-license transmission** — happy to receive them here in chat, or would you rather I set up a dedicated `docs/verification-fixtures/` folder in the repo (gitignored) so client can drop CSVs directly?
