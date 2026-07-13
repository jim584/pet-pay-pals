# Deployed-environment connectivity probe (admin-only, temporary)

## New edge function: `verify-license-probe`

Location: `supabase/functions/verify-license-probe/index.ts`. Deployed once, called once, then deleted this turn.

### Auth + input guardrails
- Requires a bearer token; resolves the user via `admin.auth.getUser(token)` and checks `public.has_role(user.id, 'admin')`. Non-admin → `403`.
- Reads no arbitrary URL from the request. The only input is method `POST` with an optional `{ include_form_flow?: boolean }` body (defaults true).
- Allowlist is hard-coded in the function file:
  ```
  TX  https://vetlicensesearch.tbvme.texas.gov/
  FL  https://www.myfloridalicense.com/wl11.asp?mode=0&SID=
  OH  https://elicense.ohio.gov/oh_verifylicense
  GA  https://verify.sos.ga.gov/verification/
  PA  https://www.pals.pa.gov/
  IL  https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx
  NY  https://www.op.nysed.gov/verification-search
  NC  https://portal.ncvmb.org/
  ```

### Connectivity probe (all 8 states)
- One `GET` per URL, `redirect: "follow"`, 12s timeout, User-Agent = `HelpAPet-VerificationBot/1.0 (+https://prowebbuilders.com/contact)`.
- Response body is streamed and truncated at **8 KB**; the truncated snippet is scanned for challenge markers, then discarded. The full body is never stored, logged, or returned.
- Recorded per state:
  - `state`, `final_url`, `http_status`, `content_type`, `response_size_bytes` (from `Content-Length` or the streamed count), `elapsed_ms`, `timestamp`
  - `challenge_markers`: array selected from `["F5","Cloudflare","Incapsula","Captcha","Akamai","ServiceUnavailable"]` based on regex hits inside the 8 KB snippet
  - `has_form`: boolean (did the snippet contain `<form` / `<input`)
- No headers, cookies, `Set-Cookie` values, tokens, or HTML are logged or returned.

### Form-flow probe (NY + NC only, when `include_form_flow=true`)
Purpose: determine only whether the search action can be submitted end-to-end without JS. Uses a **clearly invalid** license number so no real person's data is touched.
- Test value: `license_number = "00000000"`, `last_name = "ZZZZZZ"` — impossible strings on both boards. This is **not** an adapter verification test; results are reported as "form-flow signals" only.
- **NY**: after the initial GET, follow to the eservices form action and issue one POST with the invalid values. Record `http_status`, `elapsed_ms`, whether the response mentions "no results" / "not found" / "captcha" / "javascript required", and whether a session cookie was required (i.e. did the POST work without one — we don't log the cookie value, only a boolean).
- **NC**: same shape. If NC is a Thentia SPA that hits a JSON API, attempt one GET against the public API path visible in the initial HTML; report status + `Content-Type` and whether the JSON parses.
- No storage of response bodies. Only the signal booleans/strings above are logged.

### Response shape (returned to the calling admin only)
```json
{
  "connectivity": [ { state, final_url, http_status, content_type, response_size_bytes,
                     elapsed_ms, challenge_markers, has_form, timestamp } ],
  "form_flow":    [ { state, http_status, elapsed_ms, no_results_seen, captcha_seen,
                     js_required_seen, session_cookie_required, timestamp } ],
  "summary_buckets": {
    "directly_accessible": [...],
    "accessible_form_ok":  [...],
    "browserless_required":[...],
    "captcha_or_manual":   [...],
    "url_stale_or_unresolved":[...],
    "temporarily_unavailable":[...]
  }
}
```
The same summary is also written to `edge-function-logs` (structured `console.log`) so we have a durable record even if the response is lost.

### Delete after the probe
- After the run completes, this turn also deletes `supabase/functions/verify-license-probe/` and calls `supabase--delete_edge_functions` for the same name so the endpoint is gone before the turn ends.
- The `has_role` check + admin-only auth is the belt; the delete is the suspenders.

## Rate limiting + safety
- Sequential, not parallel. 1s pause between board requests → 8 requests over ~15–25s worst case.
- Hard 60s ceiling on the whole handler; any state that hasn't responded by then is recorded as `timeout`.
- Retries: none. One shot per URL.

## What I'll send back to you
- The `summary_buckets` table (exactly the six buckets you specified).
- A recommendation between NY and NC based on: `challenge_markers`, form-flow `http_status`, whether a session cookie was required, and whether NC's SPA needs an API discovery step.
- If either NY or NC is fully accessible with no session requirement, I'll recommend it as the next adapter to harden and stop there — I will not start hardening in this turn.

## Not doing this turn
- No Browserless wiring.
- No adapter code changes for any state.
- No fixture captures.
- No writes to any `vet_*` tables (the probe function does not touch application data).

---

## Probe results (recorded 2026-07-13T23:32Z, from deployed edge function eu-central-1)

### Six-bucket summary
| Bucket | States |
|---|---|
| directly_accessible | *(none)* |
| accessible_form_ok | FL |
| browserless_required | OH (F5), GA (Cloudflare 403), NC (F5+Cloudflare markers but 200 with form) |
| captcha_or_manual | PA |
| url_stale_or_unresolved | TX (DNS NXDOMAIN on `vetlicensesearch.tbvme.texas.gov`) |
| temporarily_unavailable | IL (connection reset), NY (12s timeout) |

### Per-state connectivity
| State | Status | Bytes | Elapsed | Markers | Notes |
|---|---|---|---|---|---|
| TX | DNS fail | — | — | — | Host doesn't resolve. Board URL in `boards.ts` is stale. |
| FL | 200 | 29,510 | 718ms | none | Real HTML, no WAF markers. **Only board fully reachable.** |
| OH | 200 | 8,192 (truncated) | 837ms | F5 | Blocked by F5 WAF. |
| GA | 403 | 5,681 | 278ms | Cloudflare | Cloudflare challenge. |
| PA | 200 | 5,783 | 572ms | Captcha | Captcha gate. |
| IL | ECONNRESET | — | — | — | Server actively refuses Deno Deploy egress. |
| NY | AbortError (>12s) | — | — | — | Slow or blocked; needs longer probe to disambiguate. |
| NC | 200 | 8,192 (truncated) | 522ms | F5, Cloudflare | Renders form but WAF markers present. |

### Form-flow probes (invalid test values, not verification tests)
- **NY** POST to `eservices.nysed.gov/professions/verification-search`: aborted (>15s). Cannot classify.
- **NC** GET `portal.ncvmb.org/api/registrant/search?q=00000000`: 404, 1,245 bytes, `session_cookie_required=true`, `no_results_seen=true`. API path guess is wrong; real endpoint needs discovery from the SPA bundle.

### Recommendation
- **NY is not currently a viable first adapter** — it timed out on both connectivity and form-flow probes from Deno Deploy. Before choosing NY, re-probe with a 25s timeout to distinguish "slow" from "blocked".
- **NC is not viable without WAF handling** — F5+Cloudflare markers on the landing page and the SPA/API path needs reverse-engineering.
- **FL is the standout** — the only board that responded 200 with real HTML and no challenge markers from the deployed environment. Not on the original NY/NC shortlist, but the data says FL is the honest first-adapter candidate. FL uses the DBPR "wl11.asp" search which is a classic ASP form flow — likely tractable without Browserless.
- Suggested next step (not executed): switch the "first adapter to harden" from NY to **FL**, and fix the stale TX URL as a separate cleanup.

### Cleanup done this turn
- Edge function `verify-license-probe` deleted from the project.
- `supabase/functions/verify-license-probe/` directory removed from the codebase.
- `PROBE_ADMIN_TOKEN` secret deleted after this record was written.
- No production code, scheduled task, or admin feature referenced the endpoint or secret (verified with `rg`).
