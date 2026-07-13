# Phase 1 Adapter Requirements — 9 States

Michigan stays **manual review** (robots.txt disallows automated lookup). No change there.

Below is the per-state reference sheet you asked for. All URLs are the public license-verification portals published by each board. "Automated lookup permitted" reflects a review of each site's robots.txt and terms-of-use as of this planning pass — I'll re-verify each one at fixture-capture time and flip the adapter to manual if anything has changed.

## State-by-state table

### CA — California Veterinary Medical Board
- **Lookup URL:** https://search.dca.ca.gov/
- **Search fields:** License Type = "Veterinarian", License Number **or** Last Name + First Name
- **License number format:** digits, typically 4–5 (e.g. `12345`), no prefix
- **Full name required:** No (number alone works); yes if searching by name
- **License type required:** Yes ("Veterinarian" vs "Veterinary Premises" vs "RVT")
- **DOB / non-public field:** No
- **JS / Browserless:** No — server-side POST to `search.dca.ca.gov` returns HTML
- **Expected result fields:** licensee name, license number, license type, status ("Clear" / "Delinquent" / "Cancelled" / "Revoked"), issue date, expiration date, city/state, secondary-status text
- **Automated lookup permitted:** Yes (public DCA portal, no robots block on `/`)
- **Current adapter status:** implemented, unvalidated

### TX — Texas Board of Veterinary Medical Examiners
- **Lookup URL:** https://vetsearch.tbvme.texas.gov/ (Licensee Search)
- **Search fields:** License Number **or** Last Name + First Name; License Type filter
- **License number format:** digits, typically 4–5, no prefix
- **Full name required:** No if number provided
- **License type required:** Optional filter (Veterinarian / LVT / Equine Dental Provider)
- **DOB / non-public field:** No
- **JS / Browserless:** No — GET with query string returns server-rendered table
- **Expected result fields:** name, license #, license type, status ("Active" / "Expired" / "Retired" / "Revoked"), original issue date, expiration date, county
- **Automated lookup permitted:** Yes (public portal, no robots block)
- **Current adapter status:** implemented, unvalidated

### FL — Florida Department of Business & Professional Regulation (DBPR)
- **Lookup URL:** https://www.myfloridalicense.com/wl11.asp?mode=0&SID=
- **Search fields:** POST form — Board = "Veterinary Medicine", License Type, License Number OR Name
- **License number format:** letter prefix + digits, e.g. `VM7654` (Veterinarian) or `VT1234` (Vet Tech)
- **Full name required:** No if license number provided
- **License type required:** Yes (Veterinarian / Veterinary Establishment / Vet Tech)
- **DOB / non-public field:** No
- **JS / Browserless:** No — classic ASP form, cookie + POST works via fetch
- **Expected result fields:** name, license #, status ("Current, Active" / "Null and Void" / "Delinquent"), original license date, expiration date, primary address
- **Automated lookup permitted:** Yes (public DBPR portal)
- **Current adapter status:** implemented, unvalidated

### NY — NYS Office of the Professions (Veterinary Medicine)
- **Lookup URL:** https://www.op.nysed.gov/verification-search
- **Search fields:** Profession = "Veterinary Medicine (068)", Last Name + First Name **or** License Number
- **License number format:** digits, typically 5–6, no prefix
- **Full name required:** Yes when searching without number; last name at minimum
- **License type required:** Yes (Profession code 068 = Veterinarian, 069 = Vet Tech)
- **DOB / non-public field:** No
- **JS / Browserless:** **Likely yes.** New NYSED portal is React/SPA + Cloudflare; plain fetch generally returns a challenge page. Needs to be confirmed against a live request during hardening; if plain fetch works we skip Browserless.
- **Expected result fields:** name, profession, license #, status ("Registered" / "Not Registered" / "Inactive"), registration through date
- **Automated lookup permitted:** Yes (public verification portal, no robots block)
- **Current adapter status:** implemented, unvalidated — **Browserless candidate**

### PA — PA Department of State (Pennsylvania Licensing System / PALS)
- **Lookup URL:** https://www.pals.pa.gov/#/page/search
- **Search fields:** Profession = "Veterinary Medicine" → "Veterinarian"; License Number **or** Last Name + First Name
- **License number format:** letter prefix + digits, e.g. `SV012345` (Standard Veterinarian) or `VT######`
- **Full name required:** No if number provided
- **License type required:** Yes
- **DOB / non-public field:** No
- **JS / Browserless:** **Conditional.** PALS is Angular SPA backed by JSON API endpoints. If we can reach the JSON API directly with a stable payload, plain fetch works; if the API requires an anti-forgery token minted by the SPA, Browserless is needed. To be confirmed during hardening.
- **Expected result fields:** name, license #, license type, status ("Active" / "Expired" / "Lapsed" / "Suspended"), issue date, expiration date, city/state
- **Automated lookup permitted:** Yes (public PALS portal)
- **Current adapter status:** implemented, unvalidated — **Browserless conditional**

### IL — IDFPR (Illinois Dept. of Financial & Professional Regulation)
- **Lookup URL:** https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx
- **Search fields:** ASP.NET WebForms — License Type = "Veterinarian", License Number OR Last Name + First Name
- **License number format:** digits with dot separator, e.g. `090.######`
- **Full name required:** No if number provided
- **License type required:** Yes
- **DOB / non-public field:** No
- **JS / Browserless:** No, but requires a two-step POST with `__VIEWSTATE` / `__EVENTVALIDATION` scraped from the initial GET. Brittle but doable server-side.
- **Expected result fields:** name, license #, license type, status ("Active" / "Expired" / "Not Renewed" / "Discipline"), original issue date, expiration date, city
- **Automated lookup permitted:** Yes (public lookup)
- **Current adapter status:** implemented, unvalidated — **viewstate brittleness risk**

### OH — Ohio Veterinary Medical Licensing Board
- **Lookup URL:** https://elicense.ohio.gov/OH_HomePage (License Lookup)
- **Search fields:** License Type = "Veterinarian" / "RVT", License Number OR Last Name + First Name
- **License number format:** digits with dot, e.g. `70.######` (Veterinarian) or `73.######` (RVT)
- **Full name required:** No if number provided
- **License type required:** Yes
- **DOB / non-public field:** No
- **JS / Browserless:** No — eLicense Ohio exposes a stable JSON endpoint the SPA calls; server-side fetch works
- **Expected result fields:** name, license #, license type, status ("Active" / "Inactive" / "Expired" / "Revoked"), issue date, expiration date, county
- **Automated lookup permitted:** Yes
- **Current adapter status:** implemented, unvalidated

### GA — Georgia State Board of Veterinary Medicine
- **Lookup URL:** https://verify.sos.ga.gov/verification/
- **Search fields:** Board = "Veterinary Medicine", Profession = "Veterinarian", License Number OR Last Name + First Name
- **License number format:** letter prefix + digits, e.g. `VET######`
- **Full name required:** No if number provided
- **License type required:** Yes
- **DOB / non-public field:** No
- **JS / Browserless:** No — Thentia platform with public HTML search results; server-side fetch works
- **Expected result fields:** name, license #, license type, status ("Active" / "Expired" / "Lapsed" / "Revoked"), issue date, expiration date, city
- **Automated lookup permitted:** Yes
- **Current adapter status:** implemented, unvalidated

### NC — North Carolina Veterinary Medical Board
- **Lookup URL:** https://portal.ncvmb.org/verification
- **Search fields:** License Type = "Veterinarian" / "RVT", License Number OR Last Name + First Name
- **License number format:** digits, typically 4 (e.g. `4321`)
- **Full name required:** No if number provided
- **License type required:** Yes
- **DOB / non-public field:** No
- **JS / Browserless:** **Likely yes.** Portal is a Thentia SPA with client-rendered results; plain fetch tends to return the shell. Confirm with a live request; if the underlying JSON is reachable, skip Browserless.
- **Expected result fields:** name, license #, license type, status ("Active" / "Expired" / "Lapsed" / "Revoked"), issue date, expiration date, city
- **Automated lookup permitted:** Yes
- **Current adapter status:** implemented, unvalidated — **Browserless candidate**

## Summary rows

| State | Browserless? | Adapter status | Notes |
|-------|--------------|----------------|-------|
| CA | No | implemented | Stable HTTP |
| TX | No | implemented | Stable HTTP |
| FL | No | implemented | Classic ASP POST |
| NY | Likely | implemented | Cloudflare/SPA, verify first |
| PA | Conditional | implemented | Angular SPA + JSON; verify token requirement |
| IL | No | implemented | WebForms VIEWSTATE brittleness |
| OH | No | implemented | Stable JSON endpoint |
| GA | No | implemented | Thentia HTML results |
| NC | Likely | implemented | Thentia SPA, verify first |

## Fixture-capture rules (built into the harness before capture)

- Strip everything except: licensee name, license #, license type, status text, issue date, expiration date, city/state. Redact addresses to city+state, remove phone/email, remove NPI/SSN/DOB if any board leaks them.
- No auth headers, cookies, `Set-Cookie`, `Authorization`, `X-*` tokens, Browserless URLs, or API keys in fixture files. The `withFixture` harness only records response bodies + status; request headers are dropped.
- Per state, capture three fixtures: `<state>-active.html|json`, `<state>-expired.html|json` (or inactive/lapsed/revoked, whichever the board publishes), `<state>-notfound.html|json`.
- Fixture tests stub `globalThis.fetch` and assert zero live network calls (add a guard that fails the test if the stub isn't installed).

## Confirmations against your checklist

- **Individual feature flag per adapter:** yes — `verification_state_flags` table already has one row per state; toggling `enabled=false` forces `pending_review`.
- **Failed lookups do not block signup:** yes — `verify-vet-license` returns `pending_review` on `source_unavailable`, and the vet-signup flow treats `pending_review` and `verified` as non-blocking (only explicit `unverified` blocks). I'll add an integration test to lock this behavior.
- **Admin dashboard shows source, result, reason, timestamp:** yes — coverage page reads `vet_verification_attempts` with `source`, `status`, `decision.reason`, `created_at` per row. I'll add a per-state drill-down panel showing the last 20 attempts with those four columns.
- **Raw board responses not permanently stored:** currently `vet_verification_attempts.payload` includes a `raw` snippet. I'll change the adapter to store only the parsed `decision` object + a short `evidence` string (name-on-record, status text, expiration) and drop `raw` before insert. A nightly cleanup job will purge any legacy `raw` fields from existing rows.
- **Name matching tolerance:** already covered by `common_test.ts` (case, punctuation, diacritics, "Last, First" swap, middle initial optional, Jr/Sr/II/III suffix stripping, Levenshtein ≤ 2 for typos). I'll add explicit tests for "must NOT match" cases: different surname, different first name > distance 2, initials-only when full names differ.
- **Rate limiting, timeouts, retries:** per-state throttle (1 req/s) and 15s timeout are in `_generic.ts`. I'll add: one retry on network error / 5xx with 2s backoff, no retry on 4xx, circuit-breaker that trips to `pending_review` after 3 consecutive failures per state.
- **Fixtures contain no sensitive PII:** enforced by capture rules above + a lint test that scans `__fixtures__/` for regexes matching SSN, DOB, email, phone, `Authorization`, `Cookie`, `token`, `apiKey`.

## What I'll do once you approve this plan

1. Add the raw-response purge (adapter change + one-shot cleanup migration for existing `payload.raw`).
2. Add the retry + circuit-breaker in `_generic.ts` and unit-test both.
3. Add the fixture PII lint test and the "no live fetch" guard.
4. Add the per-state drill-down panel on `/admin/verification-coverage`.
5. Add the vet-signup non-blocking integration test.
6. Then wait for you to send the 9 sets of public test-license data (name, license #, expected status) so I can capture fixtures and green-light each state one at a time in the rollout order: CA → TX → OH → GA → FL → IL → PA → NY → NC.

Phases 2 and 3 remain frozen.
