# State Veterinary License Verification — Source Registry

**Status:** Research/planning artifact. No adapters activated. Nothing here is authoritative until each row's `last_source_health_check` and `validation_status` are individually confirmed.

**Scope:** All 50 U.S. states + Washington, D.C. (51 jurisdictions).

**Verification-source priority** (per project rule):
1. `official_api`
2. `official_bulk_file`
3. `permitted_public_lookup`
4. `browser_required`
5. `manual_review`
6. `not_yet_researched` (default until proven)

**Classification honesty rule:** A jurisdiction stays at `not_yet_researched` until (a) its official URL is confirmed live, (b) automated access is confirmed permitted (robots.txt / ToS reviewed), and (c) a sanitized fixture exists. Only ten jurisdictions have had any live probe (CA, MI, NY, NC, TX, FL, OH, GA, PA, IL). The remaining 41 are honestly marked `not_yet_researched` regardless of what I may "know" about their boards — the field values below for those rows are hypotheses to guide research, not confirmed data.

**Status rules** (project-wide, applied by every adapter):
| Signal | Result |
|---|---|
| Exact name+license match, status = active/current | `verified` |
| Authoritative current source reports expired, revoked, suspended, surrendered, cancelled, or inactive | `unverified` |
| Name mismatch, no match, possible typo, recent name change, uncertain, or stale dataset | `pending_review` |
| Site blocked/timeout/CAPTCHA/parse fail/source unavailable/rate limited | `pending_review` |

Automated verification remains **disabled** for a jurisdiction until source + adapter + parser + status mapping are individually validated against a known public example with a sanitized fixture. Verification failure never blocks signup — account stays `pending_review` in the Admin Dashboard.

---

## Row schema

Every row carries these fields:

- `state` — jurisdiction code
- `board` — official board name
- `official_url` — official source URL
- `proposed_method` — one of the 6 classifications above
- `required_search_fields` — what the source needs (e.g. license #, last name)
- `license_number_format` — regex/shape if known
- `returned_status_values` — status strings the source emits
- `source_update_frequency` — how often the source refreshes
- `last_source_health_check` — ISO date of last probe, or `not_yet_probed`
- `automated_access_appears_permitted` — `yes` / `no` / `unknown` (based on robots.txt + ToS scan; `unknown` = not yet reviewed)
- `challenge_present` — `none` / `captcha` / `waf` / `js_required` / `unknown`
- `adapter_feature_flag` — `verify_vet_license.<state>.enabled` (all default `false`)
- `fallback_method` — what happens when the primary method fails
- `implementation_status` — `not_started` / `in_progress` / `shipped` / `disabled`
- `validation_status` — `not_validated` / `fixture_only` / `live_probed` / `validated`

---

## Confirmed-probed jurisdictions (from prior turns)

### CA — California Veterinary Medical Board
- board: California Veterinary Medical Board (DCA)
- official_url: `https://search.dca.ca.gov/`
- proposed_method: **manual_review**
- required_search_fields: license number, license type
- license_number_format: numeric, up to 6 digits (e.g. `24766`)
- returned_status_values: `Current`, `Expired`, `Delinquent`, `Cancelled`, `Revoked`, `Surrendered`, `Suspended`
- source_update_frequency: daily (DCA daily refresh)
- last_source_health_check: 2026-07-13
- automated_access_appears_permitted: **no** (F5 WAF blocks server-side UAs regardless of robots)
- challenge_present: `waf` (F5)
- adapter_feature_flag: `verify_vet_license.ca.enabled = false`
- fallback_method: admin manual review with license upload
- implementation_status: `disabled` (registry entry removed; boards.ts marks `manual`)
- validation_status: `live_probed` (blocked)

### MI — Michigan Board of Veterinary Medicine
- board: Michigan Dept. of Licensing and Regulatory Affairs (LARA)
- official_url: `https://www.michigan.gov/lara/bureau-list/bpl/health/hp-lic-health-professionals`
- proposed_method: **manual_review** (current stance)
- required_search_fields: license number, last name
- license_number_format: alphanumeric, format varies
- source_update_frequency: unknown
- last_source_health_check: `not_yet_probed` (marked manual from the start)
- automated_access_appears_permitted: `unknown`
- challenge_present: `unknown`
- adapter_feature_flag: `verify_vet_license.mi.enabled = false`
- fallback_method: admin manual review
- implementation_status: `disabled`
- validation_status: `not_validated`

### NY — NY State Board for Veterinary Medicine (NYSED)
- board: New York State Education Department, Office of the Professions
- official_url: `https://www.op.nysed.gov/verification-search` (form action: `https://eservices.nysed.gov/professions/verification-search`)
- proposed_method: **permitted_public_lookup** (unverified — needs re-probe with 25s timeout)
- required_search_fields: profession code (`068` for vets), license number, last name
- license_number_format: numeric, 6 digits
- returned_status_values: `Registered`, `Not Registered`, `Inactive`, `Delinquent`
- source_update_frequency: real-time
- last_source_health_check: 2026-07-13 (timed out >12s on both connectivity + form-flow)
- automated_access_appears_permitted: `unknown` (needs robots.txt review; timeout not confirmed as block)
- challenge_present: `unknown` (couldn't reach the page)
- adapter_feature_flag: `verify_vet_license.ny.enabled = false`
- fallback_method: bulk file (NYSED publishes a downloadable dataset of licensed professionals — needs confirmation)
- implementation_status: `not_started`
- validation_status: `live_probed` (timed out)

### NC — North Carolina Veterinary Medical Board
- board: NC Veterinary Medical Board
- official_url: `https://portal.ncvmb.org/`
- proposed_method: **browser_required**
- required_search_fields: name and/or license number (Thentia SPA)
- license_number_format: numeric, 4–5 digits
- returned_status_values: `Active`, `Inactive`, `Expired`, `Retired`
- source_update_frequency: daily
- last_source_health_check: 2026-07-13 (200 with F5+Cloudflare markers; API path `/api/registrant/search` returned 404 — needs discovery)
- automated_access_appears_permitted: `unknown` (Thentia ToS review required)
- challenge_present: `waf`, `js_required`
- adapter_feature_flag: `verify_vet_license.nc.enabled = false`
- fallback_method: manual review
- implementation_status: `not_started`
- validation_status: `live_probed` (blocked at API layer)

### TX — Texas Board of Veterinary Medical Examiners
- board: TBVME
- official_url: **needs correction** — `vetlicensesearch.tbvme.texas.gov` returns NXDOMAIN. Correct URL likely `https://www.tbvme.texas.gov/verification/` or `https://vo.licensing.hpc.texas.gov/` (HPC took over TBVME in 2023 under HB 1755). Requires research.
- proposed_method: `not_yet_researched` (URL stale)
- required_search_fields: unknown pending URL confirmation
- license_number_format: numeric, 4–5 digits
- source_update_frequency: unknown
- last_source_health_check: 2026-07-13 (DNS NXDOMAIN)
- automated_access_appears_permitted: `unknown`
- challenge_present: `unknown`
- adapter_feature_flag: `verify_vet_license.tx.enabled = false`
- fallback_method: manual review
- implementation_status: `not_started`
- validation_status: `not_validated`

### FL — Florida Dept. of Business & Professional Regulation
- board: FL Board of Veterinary Medicine (under DBPR)
- official_url: `https://www.myfloridalicense.com/wl11.asp?mode=0&SID=`
- proposed_method: **permitted_public_lookup** (candidate — pending robots.txt review + fixture)
- required_search_fields: license number, last name, license type (`Veterinary Medicine`)
- license_number_format: alpha prefix + digits, e.g. `VM12345`
- returned_status_values: `Clear/Active`, `Null and Void`, `Delinquent`, `Voluntary Relinquishment`, `Revoked`
- source_update_frequency: real-time DB view
- last_source_health_check: 2026-07-13 (200, 29 KB real HTML, no challenge markers)
- automated_access_appears_permitted: `unknown` (needs robots.txt + ToS review)
- challenge_present: `none` (on landing page — form submission not yet probed)
- adapter_feature_flag: `verify_vet_license.fl.enabled = false`
- fallback_method: FL DBPR publishes a downloadable weekly file (`https://www.myfloridalicense.com/DBPR/os/documents/…`) — candidate bulk fallback pending confirmation
- implementation_status: `not_started`
- validation_status: `live_probed` (landing only)

### OH — Ohio Veterinary Medical Licensing Board
- board: OVMLB (verification via `elicense.ohio.gov`)
- official_url: `https://elicense.ohio.gov/oh_verifylicense`
- proposed_method: **browser_required**
- last_source_health_check: 2026-07-13 (F5 challenge, 8 KB truncated)
- automated_access_appears_permitted: `unknown`
- challenge_present: `waf` (F5)
- adapter_feature_flag: `verify_vet_license.oh.enabled = false`
- fallback_method: manual review
- implementation_status: `not_started`
- validation_status: `live_probed` (blocked)

### GA — Georgia State Board of Veterinary Medicine
- board: GA SOS Professional Licensing Boards Division
- official_url: `https://verify.sos.ga.gov/verification/`
- proposed_method: **browser_required**
- last_source_health_check: 2026-07-13 (Cloudflare 403)
- automated_access_appears_permitted: `unknown`
- challenge_present: `waf` (Cloudflare)
- adapter_feature_flag: `verify_vet_license.ga.enabled = false`
- fallback_method: manual review
- implementation_status: `not_started`
- validation_status: `live_probed` (blocked)

### PA — Pennsylvania State Board of Veterinary Medicine
- board: PA Bureau of Professional and Occupational Affairs (PALS)
- official_url: `https://www.pals.pa.gov/`
- proposed_method: **manual_review** (captcha-gated)
- last_source_health_check: 2026-07-13 (200, captcha markers)
- automated_access_appears_permitted: `no` (captcha implies user-only)
- challenge_present: `captcha`
- adapter_feature_flag: `verify_vet_license.pa.enabled = false`
- fallback_method: manual review
- implementation_status: `not_started`
- validation_status: `live_probed`

### IL — Illinois Dept. of Financial and Professional Regulation
- board: IDFPR (Veterinary Medicine and Farriery)
- official_url: `https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx`
- proposed_method: `not_yet_researched` (connection reset from Deno Deploy — may be IP-block)
- last_source_health_check: 2026-07-13 (ECONNRESET)
- automated_access_appears_permitted: `unknown`
- challenge_present: `unknown`
- adapter_feature_flag: `verify_vet_license.il.enabled = false`
- fallback_method: manual review
- implementation_status: `not_started`
- validation_status: `live_probed` (refused)

---

## Remaining 41 jurisdictions — hypotheses only, all `not_yet_researched`

Every row below has `last_source_health_check = not_yet_probed`, `automated_access_appears_permitted = unknown`, `challenge_present = unknown`, `implementation_status = not_started`, `validation_status = not_validated`, and `adapter_feature_flag = verify_vet_license.<state>.enabled = false`. Board names and URLs are best-effort starting points for research, not confirmed data.

| State | Board | Starting-point URL | Hypothesis method |
|---|---|---|---|
| AK | Alaska Board of Veterinary Examiners | `https://www.commerce.alaska.gov/cbp/main/search/professional` | permitted_public_lookup |
| AL | Alabama State Board of Veterinary Medical Examiners | `https://asbvme.alabama.gov/` | permitted_public_lookup |
| AR | Arkansas Veterinary Medical Examining Board | `https://www.avmeb.arkansas.gov/` | manual_review |
| AZ | Arizona State Veterinary Medical Examining Board | `https://vetboard.az.gov/` | permitted_public_lookup |
| CO | Colorado State Board of Veterinary Medicine (DORA) | `https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx` | permitted_public_lookup |
| CT | CT Dept. of Public Health, Veterinary Medicine | `https://www.elicense.ct.gov/Lookup/LicenseLookup.aspx` | permitted_public_lookup |
| DC | DC Board of Veterinary Medicine | `https://dchealth.dc.gov/service/verify-license` | manual_review |
| DE | Delaware Board of Veterinary Medicine | `https://delpros.delaware.gov/OH_VerifyLicense` | permitted_public_lookup |
| HI | Hawaii Board of Veterinary Medicine | `https://mypvl.dcca.hawaii.gov/public-license-search/` | permitted_public_lookup |
| IA | Iowa Board of Veterinary Medicine | `https://iowa.us.thentiacloud.net/webs/iowa/register/` | browser_required (Thentia SPA) |
| ID | Idaho Board of Veterinary Medicine | `https://ibol.idaho.gov/eIBOL/Public/Search.aspx` | permitted_public_lookup |
| IN | Indiana Board of Veterinary Medical Examiners | `https://mylicense.in.gov/EVerification/` | permitted_public_lookup |
| KS | Kansas Board of Veterinary Examiners | `https://ksbve.us.thentiacloud.net/webs/ksbve/register/` | browser_required (Thentia SPA) |
| KY | Kentucky Board of Veterinary Examiners | `https://kbve.ky.gov/Pages/default.aspx` | manual_review |
| LA | Louisiana Board of Veterinary Medicine | `https://lsbvm.org/roster-of-licensees/` | official_bulk_file (published roster) |
| MA | MA Board of Registration in Veterinary Medicine | `https://elicensing21.mass.gov/CitizenPortal/` | permitted_public_lookup |
| MD | Maryland State Board of Veterinary Medical Examiners | `https://www.mda.state.md.us/vetboard/Pages/roster_list.aspx` | official_bulk_file |
| ME | Maine Board of Veterinary Medicine | `https://www.pfr.maine.gov/almsonline/almsquery/` | permitted_public_lookup |
| MN | Minnesota Board of Veterinary Medicine | `https://mn.gov/boards/veterinary-medicine/` | permitted_public_lookup |
| MO | Missouri Veterinary Medical Board | `https://renew.pr.mo.gov/licensee-search.asp` | permitted_public_lookup |
| MS | Mississippi Board of Veterinary Medicine | `https://msbvm.ms.gov/` | manual_review |
| MT | Montana Board of Veterinary Medicine | `https://ebiz.mt.gov/POL/` | permitted_public_lookup |
| ND | ND Board of Veterinary Medical Examiners | `https://www.nddvmb.com/` | manual_review |
| NE | Nebraska Board of Veterinary Medicine & Surgery | `https://dhhs-lis.ne.gov/Public/publiclookup` | permitted_public_lookup |
| NH | NH Board of Veterinary Medicine | `https://forms.nh.gov/licenseverification/` | permitted_public_lookup |
| NJ | NJ State Board of Veterinary Medical Examiners | `https://newjersey.mylicense.com/verification/` | permitted_public_lookup |
| NM | New Mexico Board of Veterinary Medicine | `https://www.rld.nm.gov/boards-and-commissions/individual-boards-and-commissions/veterinary-medicine/` | manual_review |
| NV | Nevada State Board of Veterinary Medical Examiners | `https://nvvetboard.us/verify/` | permitted_public_lookup |
| OK | Oklahoma State Board of Veterinary Medical Examiners | `https://osbvme.us/` | manual_review |
| OR | Oregon Veterinary Medical Examining Board | `https://obvm.oregon.gov/Clients/ORVMB/Public/LicenseeSearch.aspx` | permitted_public_lookup |
| RI | RI Board of Veterinary Medicine | `https://healthri.mylicense.com/Verification/` | permitted_public_lookup |
| SC | SC Board of Veterinary Medical Examiners (LLR) | `https://verify.llronline.com/LicLookup/Vet/Vet.aspx` | permitted_public_lookup |
| SD | SD Board of Veterinary Medical Examiners | `https://sdbvme.sd.gov/` | manual_review |
| TN | TN Board of Veterinary Medical Examiners | `https://apps.health.tn.gov/Licensure/default.aspx` | permitted_public_lookup |
| UT | Utah Veterinary Practice Act (DOPL) | `https://secure.utah.gov/llv/search/index.html` | permitted_public_lookup |
| VA | Virginia Board of Veterinary Medicine | `https://dhp.virginiainteractive.org/lookup/index` | permitted_public_lookup |
| VT | VT Office of Professional Regulation | `https://sos.vermont.gov/opr/find-a-professional/` | permitted_public_lookup |
| WA | Washington Veterinary Board of Governors | `https://fortress.wa.gov/doh/providercredentialsearch/` | permitted_public_lookup |
| WI | Wisconsin Veterinary Examining Board | `https://licensesearch.wi.gov/` | permitted_public_lookup |
| WV | WV Board of Veterinary Medicine | `https://wvbvm.org/` | manual_review |
| WY | Wyoming Board of Veterinary Medicine | `https://wybvm.wyo.gov/` | manual_review |

---

## Bulk-dataset governance (applies to any `official_bulk_file` adoption)

- Files may only be obtained from official government or board sources.
- Store: `official_source_url`, `published_at`, `retrieved_at`, `sha256`.
- Refresh cadence matches the source's own schedule (weekly for FL DBPR, monthly for many rosters).
- Upsert on `(state, license_number)`; never accumulate duplicates.
- Retain only fields required for verification: license #, license type, full legal name, status, expiration date. **No addresses, phones, or unrelated PII.**
- A missing record in a stale snapshot is **never** proof of an invalid license — such lookups resolve to `pending_review`.

## Manual-review upload governance

For every jurisdiction with `proposed_method = manual_review`, the admin queue accepts:
- License certificate or wallet card
- Optional official public-lookup URL
- Supporting verification document

Storage requirements:
- Private Supabase bucket (`vet-credentials` — already exists, non-public).
- Admin-only RLS (`has_role(auth.uid(), 'admin')`).
- File-type allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`.
- Size cap: 10 MB.
- Malware scan hook: reserved (not yet wired; note in rollout plan).
- Audit log row on upload, view, decision, and deletion.
- Retention: kept for the life of the verified account + 7 years, or 90 days after rejection; user-initiated deletion honored on account closure per privacy policy.
