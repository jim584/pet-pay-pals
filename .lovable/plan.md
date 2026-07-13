## Build State-by-State Veterinary License Scrapers (All 50 States + DC)

Extend the existing `verify-vet-license` edge function with real per-state lookup adapters, rolled out in phases so vets get actual verification instead of `pending_review` fallbacks.

### Architecture

Keep the modular pattern already in place at `supabase/functions/verify-vet-license/states/`. Each state gets its own file exporting a common interface:

```ts
export interface StateAdapter {
  code: string;                  // "CA"
  name: string;                  // "California"
  boardName: string;             // "California Veterinary Medical Board"
  sourceUrl: string;             // public lookup URL shown to admins
  lookup(input: {
    licenseNumber: string;
    lastName: string;
    firstName?: string;
  }): Promise<LookupResult>;
}

type LookupResult =
  | { status: "verified"; license_status: string; name_on_record: string; raw: unknown }
  | { status: "unverified"; reason: string; raw: unknown }
  | { status: "source_unavailable"; reason: string; http_status?: number };
```

`states/index.ts` maps `state_code → adapter` and falls back to `pending_review` for any state not yet wired in.

### Per-state technique matrix

State boards fall into 4 categories. Each adapter picks the cheapest working technique:

1. **Direct JSON/AJAX endpoint** (best): board exposes an internal XHR the search page calls. We hit it with `fetch` + JSON parse. Examples: CA (DCA License Search JSON), TX (TDLR search), CO (DORA), OR, WA.
2. **HTML form POST + parse** (common): scrape the results table with a small HTML parser (`deno-dom`). Examples: NY, FL, NC, VA, MA, IL, PA, OH, GA, MI, AZ, TN, IN, MO, WI, MN, MD, NJ, SC, KY, OK, LA, AR, MS, AL, IA, KS, NV, UT, NM, WV, NE, ID, ND, SD, MT, WY, VT, NH, ME, RI, DE, HI, AK, DC.
3. **Session/CSRF-token flow**: pre-fetch the page, extract hidden fields, then POST. Examples: NY (ASP.NET viewstate), a few others.
4. **JS-only / Cloudflare-gated**: needs a headless browser. Route through **Browserless.io** (or Firecrawl scrape as fallback). Reserved for states that resist steps 1–3.

Name matching helper (shared): last-name exact (case + diacritics normalized), first-name fuzzy via Levenshtein ≤ 2 OR common-nickname map.

### Phased rollout

**Phase 1 — Top-10 by vet population (ship first):**
CA, TX, FL, NY, PA, IL, OH, GA, NC, MI. Covers ~55% of US vets.

**Phase 2 — Next 15:**
WA, VA, MA, AZ, TN, IN, MO, WI, MN, MD, NJ, CO, SC, OR, KY.

**Phase 3 — Remaining 25 + DC:**
OK, LA, AL, AR, MS, IA, KS, NV, UT, NM, WV, NE, ID, ND, SD, MT, WY, VT, NH, ME, RI, DE, HI, AK, CT, DC.

Each phase is one deploy. States not yet implemented continue returning `pending_review` (existing behavior — no regression).

### Reliability & policy

- Cache each state's result in `vet_verification_attempts` (already exists) with `raw` payload + HTTP status.
- Timeout each fetch at **15s**; on timeout or HTTP 5xx → `source_unavailable` (not `unverified`) — the existing hourly `vet-verification-retry` cron picks it up.
- Rate-limit per state: max 1 outbound request/sec per state board (some boards block bursts). Implement with a simple in-memory queue inside the function invocation.
- User-Agent: identify as `HelpAPet-VerificationBot/1.0 (+contact-url)` — most boards allow public-record lookups but block anonymous scrapers.
- Respect robots.txt where boards publish one; skip and mark `not_supported` if disallowed (rare for public license lookups).

### Fallback for JS-heavy states

Add a new secret **`BROWSERLESS_TOKEN`** (I'll request it when we hit the first state that needs it — likely NY, MA, or NJ). Browserless is a hosted headless-Chrome REST API (~$50/mo starter). Adapter code:

```ts
const html = await fetch(`https://chrome.browserless.io/content?token=${token}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url, waitFor: "table.results" }),
}).then(r => r.text());
```

If the user prefers not to add Browserless, those specific states stay on `pending_review` + manual admin override.

### Admin dashboard changes

Small additions to `AdminVetDetailPage`:
- Show **"Verification source"** badge: `direct_api` | `html_scrape` | `headless_browser` | `not_supported`.
- Show **per-state coverage** on a new admin page `AdminVerificationCoveragePage` — a table of all 50 states with implementation status + last successful check timestamp.

### What's NOT in scope

- **AAVSB VAULT paid API** — requires B2B contract + fees; skip unless user signs up separately.
- **Fear Free scraper** — separate task; current directory-ping is fine until Fear Free publishes a real API. (Ask them via their partnership form.)
- **Automatic disciplinary-action polling** — future work.

### Deliverables per phase

1. New file `supabase/functions/verify-vet-license/states/<xx>.ts` per state.
2. Register in `states/index.ts`.
3. Unit test file `states/<xx>_test.ts` with a recorded fixture response (so we can re-run without hitting the live board).
4. Update `AdminVerificationCoveragePage` counts.

### Open questions before I start

1. **Green-light Browserless?** Needed for ~5–8 JS-only state boards. Alternative: leave those on `pending_review`.
2. **Ship phase-by-phase (approve after each)** or **build all 50 in one pass**? Phased is safer — each state's HTML can break independently and we'll want to catch regressions early.
3. **Should unverified results block ticket receipt** now, or keep the current "flag but allow" behavior until coverage is high?
