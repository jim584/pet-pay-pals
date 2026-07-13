## Phase 1 Hardening — Pre-work Review

This plan answers your Browserless and license-testing questions before any code changes. No files will be modified until you approve.

---

### 1. Boards likely to require Browserless (Phase 1 only)

Based on how each board's public lookup page is served today. "Likely" = current `fetch`-based adapter is expected to fail; only a real test with a valid license number confirms it.

| State | Board | Why plain `fetch` is likely insufficient | Robots / ToS posture |
|---|---|---|---|
| **NY** | NYSED Office of the Professions | Search page is a React SPA; results render client-side after XHR to an internal endpoint that requires an anti-CSRF header set by the SPA bootstrap. | `robots.txt` allows `/verification-search`; no ToS clause forbidding automated public-record lookups. State law (Education §6704) explicitly makes the roster public. |
| **NC** | NC Veterinary Medical Board (Thentia portal) | Thentia SPA hydrates the directory client-side; the JSON API requires a session token minted by the SPA. | `portal.ncvmb.org/robots.txt` currently returns 404 (no policy). Board's public disclaimer says the directory "may be used to verify licensure" — no automation ban. |
| **MI** | LARA Accela | ASP.NET WebForms with dynamic `__VIEWSTATE`, `__EVENTVALIDATION`, and Accela's client-side session cookie chain. Doable via HTTP but fragile; headless is more reliable. | `aca-prod.accela.com/robots.txt` disallows crawlers on `/GeneralProperty/*` search paths — **automated access likely NOT permitted**. See note below. |
| **PA** | PALS | SPA + Cloudflare bot-management (JS challenge on some IPs). API responds directly with correct headers, but Cloudflare intermittently 403s server-to-server calls. | `pals.pa.gov/robots.txt` allows the API path; Cloudflare block is a technical, not policy, barrier. |
| **IL** | IDFPR eLicense | ASP.NET WebForms + dynamic viewstate; similar to MI but no explicit robots disallow. | `ilesonline.idfpr.illinois.gov/robots.txt` — no relevant disallow. Public roster. |

**Boards that should NOT need Browserless:** CA (DCA JSON works from `fetch`), TX (TBVME JSON API), FL (MQA POST form parses cleanly), OH (eLicense3 has a direct query URL), GA (SOS verify.aspx returns full HTML).

**Michigan robots.txt concern:** LARA's `robots.txt` disallows the search path. Even though the data is public record under Michigan FOIA, using a headless browser to bypass that signal is disrespectful and could get our IP banned. Recommendation for MI: **do NOT scrape at all — leave as manual review** with a deep-link to the LARA site. Same policy check will apply to any Phase 2/3 board that disallows in robots.

---

### 2. Browserless usage, cost, and data handling

**Estimated usage (Phase 1, assuming all 5 states above use Browserless):**
- Signup verification: 1 request per new vet in one of those 5 states.
- Cron retry: up to 3 additional requests over 72h for any `source_unavailable` result.
- Rough ceiling: **~4 requests × 5 states × new-vets-per-month**. At 100 new vets/mo evenly distributed → ~40 Browserless requests/month.
- Each request ~2-5s of headless-Chrome time.

**Cost (Browserless Cloud pricing, current):**
- Free tier: 6 hours/mo of session time.
- Starter: $50/mo → 15 hours + 5 concurrent sessions.
- At the volume above we'd stay in the free tier for months.

**What we would send to Browserless (per request):**
- The board's public lookup URL (contains the license number as a query parameter, e.g. `?licnum=12345`).
- The license number and (for NY-style adapters) the last name — both required to filter results.
- Nothing else. No email, no `auth.uid()`, no full legal name, no ticket data.

**What Browserless retains (per their DPA):**
- Standard request logs (IP, timestamp, URL) for 30 days.
- No screenshot/artifact storage unless we explicitly write to `/api/screenshot`.
- Data-Processing Agreement available; they are SOC 2 Type II.
- License numbers are public records, but their appearance in a third-party log is worth flagging. Options: (a) accept, or (b) use their EU region + request 7-day log retention, or (c) self-host.

**Self-hosted alternative (recommended if you're log-sensitive):**
- Deno Deploy / Supabase Edge does **not** run headless Chrome — no `puppeteer`/`playwright` in Deno's edge runtime.
- Realistic self-host paths: (1) a small Fly.io / Railway container running `playwright` (~$5-10/mo idle), (2) a Cloudflare Browser Rendering worker (paid Workers plan, ~$5/mo + usage), (3) a Render.com Docker service.
- Trade-off: we own the code and logs, but we also own patching, scaling, and IP-reputation issues. For 5 states + ~40 req/mo, a $5 Fly.io micro-VM is probably the cleanest choice.

---

### 3. Test-license fixture request (for the client)

For each state below we need **one** verified example. Prefer a Fear Free directory or state-board-website public listing so you're not exposing private practitioner data.

Required fields per state:

| Field | Notes |
|---|---|
| State code | e.g. `CA` |
| Veterinarian's full legal name | As it appears on the license (First Middle Last). |
| License number | Exactly as issued (leading zeros matter in some states). |
| License type | Only where the board issues multiple (see per-state notes). |
| Expected license status | `Active` / `Expired` / `Inactive` / etc. |
| Expiration date | If shown publicly. Optional; used to catch date-parse regressions. |

Phase 1 states we need one test license for:

1. **CA** — license type field is not required (all vets are one code).
2. **TX** — license type: `Veterinarian` (not `LVT`, not `Equine Dental Provider`).
3. **FL** — license type: `Veterinarian` (`VM` prefix; not `Veterinary Faculty Certificate` etc.).
4. **NY** — profession code 63 (Veterinary Medicine); license type not needed.
5. **PA** — license type: `Veterinarian` (not `Veterinary Technician`).
6. **IL** — license type: `Veterinarian` (090); not `Vet Tech` (095).
7. **OH** — license type: `Veterinarian`.
8. **GA** — board 045; license type not needed.
9. **NC** — license type: `Veterinarian` (not `Veterinary Technician` / `Faculty License`).
10. **MI** — license type: `Veterinarian`. **Note we may drop MI from automation** per the robots.txt concern above; test license still helps confirm the manual-review deep-link works.

Bonus (recommended): one **expired** or **inactive** license per state so we validate that adapters correctly return `expired` / `inactive` and don't silently mark a lapsed license as `verified`.

---

### 4. Fixture-test policy

After each state is validated against a real board response:

- Save one sanitized HTML/JSON response under `supabase/functions/verify-vet-license/states/__fixtures__/<state>-<case>.txt`.
- Sanitize by replacing the tested vet's full name with `TESTVET LASTNAME`, address with `123 TEST ST`, phone/email fields with `REDACTED`. Keep the license number (it's public record) and status text intact — those are what we're testing.
- Add `states/<xx>_test.ts` using `Deno.test` + `Deno.readTextFile`. Each test stubs `fetch` to return the fixture and asserts the adapter classifies it correctly.
- CI runs fixtures only — no live board hits from tests.

---

### 5. What I will do once you approve

**Immediately (no dependencies):**
1. Add a fixture-test harness (`_fixtures.ts` helper + one green example test) so we have the plumbing ready.
2. Update `AdminVerificationCoveragePage` to also show "last successful attempt" per state, pulled from `vet_verification_attempts`.
3. Drop MI from the automated registry back to `manual` in `boards.ts`, with a note referencing the robots.txt policy.

**Once you send test licenses (per state, in any order):**
4. Live-test the adapter against the real board, adjust selectors/regex until it correctly returns `match` for active + `expired`/`inactive` for lapsed.
5. Save the sanitized fixture + write the Deno test.
6. Mark that state green in the coverage page.

**After all Phase 1 states are validated:**
7. Report which of NY / NC / PA / IL actually needed a headless browser vs. worked with plain `fetch`.
8. Come back to you with a concrete Browserless (or Fly.io self-host) proposal scoped to only the states that need it.

---

### Open questions

1. **MI decision** — Confirm you want MI removed from automated adapters given the robots.txt disallow, keeping only the manual-review deep-link.
2. **Log-sensitivity threshold** — If we do end up needing headless: Browserless Cloud (fast, 30-day logs), Browserless EU region (7-day logs), or self-hosted Fly.io ($5/mo, our own logs)?
3. **Fear Free** — Still out of scope for this round?
