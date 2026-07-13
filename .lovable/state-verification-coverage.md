# State Verification — Coverage Report

Companion to `state-verification-registry.md`. Grouped as requested. **Nothing is enabled.** Every jurisdiction's `adapter_feature_flag` is `false`.

Groupings reflect current honest evidence, not aspiration. Any row not personally probed sits in `not_yet_researched` regardless of hypothesis.

---

## 1. Automated and validated
**Count: 0.**
Nothing has been fully validated end-to-end (source + adapter + parser + status mapping + sanitized fixture + known public example). Awaiting approval to begin hardening the first adapter.

## 2. Official API identified
**Count: 0 confirmed.**
No U.S. state veterinary board is currently known to publish a machine-readable authenticated API for license verification. This may change with research on:
- LA (roster published — bulk, not API)
- MD (roster published — bulk, not API)
- Possibly NPI/NPPES — but NPI does not indicate license *status*, only that a provider claimed a license, so NPI is **not** a valid verification source on its own.

## 3. Official bulk dataset identified
**Count: 2 candidates (unconfirmed).**
- **LA** — Louisiana Board publishes a roster on `lsbvm.org/roster-of-licensees/`. Format, cadence, and license-status field coverage need confirmation.
- **MD** — Maryland State Board publishes a licensee list PDF/XLS on `mda.state.md.us/vetboard/`. Same confirmation needed.
- **FL** — DBPR publishes weekly downloadable files; candidate *fallback* for FL if the live lookup proves unreliable.
- **NYSED** — publishes downloadable professional license data; candidate *fallback* for NY.

None adopted yet. Bulk adoption requires the governance in the registry (source URL, `published_at`, upsert-on-license-number, minimal fields, no PII beyond what verification needs, `pending_review` on stale-miss).

## 4. Permitted public lookup identified
**Count: 1 live-probed candidate + ~28 unconfirmed hypotheses.**
- **FL** — only jurisdiction to return a real 200 + real HTML with **zero** WAF/captcha/JS markers from the deployed edge function. Candidate for the first hardened adapter, pending robots.txt/ToS review, fixture capture, and status-mapping validation.
- ~28 other states have a public lookup page that looks accessible in a browser (see registry "Remaining 41" table with `permitted_public_lookup` hypothesis). None probed. All must be individually probed and reviewed before any classification is considered real.

## 5. Browser automation potentially required
**Count: 4 live-probed + several hypothesized.**

Live-probed:

### OH — elicense.ohio.gov
- Why plain server-side fails: F5 BIG-IP WAF returns an 8 KB JS challenge with an empty `<title>` before serving the real page.
- CAPTCHA involved: not directly, but the F5 challenge fingerprints headless clients.
- Automation appears permitted: `unknown`. Must review Ohio elicense ToS before any automated flow.
- Estimated lookup volume: proportional to Ohio vet signups. Rough order: tens/month at launch, low hundreds/month at scale.
- Estimated cost (if Browserless): ~$0.005–0.02 per lookup at Browserless retail; ≤ $10/month at expected volume.
- Privacy considerations: only submits license # + last name; no PII stored in query logs beyond what registry allows.
- Non-Browserless fallback: manual review with license upload.

### GA — verify.sos.ga.gov
- Why plain server-side fails: Cloudflare 403 with "Just a moment…" JS challenge on the landing page.
- CAPTCHA: implicit (Cloudflare Turnstile-style JS challenge).
- Automation appears permitted: `unknown`. GA SOS ToS review required; Cloudflare challenge presence is itself a signal the operator does not want unattended clients.
- Estimated volume/cost: similar to OH.
- Privacy: same as OH.
- Non-Browserless fallback: manual review.

### NC — portal.ncvmb.org (Thentia)
- Why plain server-side fails: Thentia SPA — landing page renders via JS after WAF check; verification data lives behind a JSON API that requires session cookies and JS-set headers. `/api/registrant/search` returned 404 to a plain GET, meaning the real endpoint is not the guessed one.
- CAPTCHA: none observed on landing, but WAF may present one under load.
- Automation appears permitted: `unknown`. Thentia's ToS (multi-tenant platform) applies; some Thentia deployments explicitly forbid scraping.
- Estimated volume/cost: similar to OH.
- Privacy: same.
- Non-Browserless fallback: manual review. (Bulk fallback unlikely — NCVMB does not publish a roster.)

### PA — pals.pa.gov (already classified `manual_review`, kept out of `browser_required`)
- Reason for not listing here as a Browserless candidate: an explicit CAPTCHA gate signals the operator wants human verification. Automating past a CAPTCHA — even via Browserless — crosses a policy line. Keep as manual.

Hypothesized (require probing before Browserless is even considered):
- **IA, KS** and any other **Thentia**-hosted board — the platform's SPA architecture will always need a browser or a reverse-engineered API contract.

## 6. CAPTCHA / manual review required
**Count: 3 live-probed.**
- **PA** — explicit CAPTCHA on `pals.pa.gov`.
- **CA** — F5 WAF hard-blocks server-side UAs; per project decision, kept as `manual_review` rather than Browserless-worked-around (F5 policy signals unattended access is not welcome).
- **MI** — kept as `manual_review` from initial rollout.

Additional jurisdictions likely to land here after probing (based on board style): AR, KY, MS, ND, NM, OK, SD, WV, WY, DC. All currently `not_yet_researched`; classification is a hypothesis.

## 7. Not yet researched
**Count: 41 jurisdictions** (all rows in the registry's "Remaining 41" table).
Plus **TX** — the previously assumed URL is dead (NXDOMAIN); reclassified from `not_yet_researched` under a corrected URL after HB 1755 consolidation (TBVME → HPC) is confirmed.
Plus **IL** — connection reset from Deno Deploy IPs may be a temporary block or a permanent IP allowlist; requires re-probe from a different egress and a robots/ToS review before any classification sticks.

---

## Numerical summary

| Group | Count |
|---|---|
| Automated and validated | 0 |
| Official API identified | 0 |
| Official bulk dataset identified | 2 candidates (LA, MD); + FL/NY as fallbacks |
| Permitted public lookup identified | 1 live-probed (FL); ~28 hypothesized |
| Browser automation potentially required | 3 live-probed (OH, GA, NC); + Thentia-hosted boards |
| CAPTCHA / manual review required | 3 live-probed (PA, CA, MI) |
| Not yet researched | 41 + TX + IL |

## Recommended sequencing (for approval, not execution)

1. **FL first** — only jurisdiction with a clean 200 from the deployed environment. Confirm robots.txt / ToS, capture a sanitized fixture using a public example license, wire the adapter with the shared status rules, ship behind `verify_vet_license.fl.enabled = false`, flip only after validation.
2. **Fix TX URL** as a parallel research task (HB 1755 → HPC lookup portal).
3. **Re-probe NY** with a 25s timeout to disambiguate slow-vs-blocked before deciding between adapter and NYSED bulk file.
4. **Probe the ~28 permitted-public-lookup hypotheses** in batches of 8–10 using the same probe pattern, one turn at a time. Each turn returns a bucketed report; no adapter work happens without your approval.
5. **Bulk-file adoption** (LA, MD) after Phase 1 adapter framework is proven — bulk has different governance (upsert, retention, stale-miss handling) that should be designed once and applied to both.
6. **Browserless decision** (OH, GA, NC, Thentia-hosted boards) deferred until: (a) usage volume estimated from real signups, (b) each board's ToS individually reviewed, (c) monthly cost approved, (d) fallback confirmed to work as a first-class path so no user is blocked when Browserless is down.

## Non-goals (explicitly not being built)

- No manually maintained database of license numbers.
- No generic heuristic adapter shared across states.
- No auto-rejection on verification failure — always `pending_review`.
- No Browserless wiring in this phase.
- No dataset imports in this phase.
- No adapter activation for any jurisdiction until per-jurisdiction validation is complete and you approve the rollout.
