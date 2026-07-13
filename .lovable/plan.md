
## Reality check on the data sources

**There is no official public API from AAVSB or Fear Free.**
- AAVSB's "Look Up A License" is a state-by-state HTML portal (~50 different sites, many with CAPTCHAs, session tokens, or ASP.NET postbacks). AAVSB's VetLifeLearn / VAULT APIs exist but are paid, credentialed B2B integrations, not open to end users.
- Fear Free has a public "Find a Fear Free Professional" directory but no documented API.

So the automated verification must be a **best-effort scraper with a graceful "pending review" fallback plus admin override** — it can't be a guaranteed real-time API check for every state. That matches what you already asked for in the last bullet.

## Solution when a source is unavailable

Never auto-flag as *Unverified* on source failure. Instead:

1. Retry the source up to 3 times with backoff.
2. If still unreachable → status = `pending_review`, `unverified_reason = "source_unavailable"`, and a scheduled retry is queued (cron-style, every 6 hours for up to 72 hours).
3. Admin dashboard shows a "Retry now" button and the last N attempts with timestamps + HTTP status.
4. Only after retries exhaust *and* an admin has looked at it does the record stay in `pending_review` — it is never silently marked `unverified`.

## Schema changes (migration)

Add to `public.vet_profiles`:

- `license_state` text (2-char state code)
- `license_full_legal_name` text
- `verification_status` enum: `pending` | `verified` | `unverified` | `pending_review` | `manual_override`
- `verification_checked_at` timestamptz
- `verification_source` text (e.g. `"CA-BVM"`, `"TX-BVME"`, `"aavsb-directory"`, `"admin_override"`)
- `verification_source_url` text
- `verification_reason` text (human-readable failure reason)
- `verification_raw` jsonb (last scraped payload for audit)
- `fear_free_verification_status` same enum
- `fear_free_checked_at`, `fear_free_source`, `fear_free_reason`, `fear_free_raw`
- Reuse existing `license_verified_at`, `license_verified_by`, `fear_free_verified_at`, `fear_free_verified_by` for admin overrides (already guarded by `guard_vet_profile_verification_fields`).

New table `public.vet_verification_attempts`:
- `id`, `vet_profile_id`, `kind` (`license` | `fear_free`), `attempted_at`, `status`, `http_status`, `source`, `error`, `payload jsonb`.

Add GRANTs + RLS: vet can read own attempts, admin reads all.

## Backend — new edge functions

1. **`verify-vet-license`** (`verify_jwt = false`, called by trigger + cron + admin)
   - Input: `vet_profile_id`.
   - Loads profile, dispatches to a per-state scraper module keyed by `license_state`.
   - Each state module returns `{ status: "match" | "no_match" | "expired" | "inactive" | "source_unavailable" | "ambiguous", licensee_name, license_status_text, expiration, source_url, raw }`.
   - Name matching: normalized (lowercase, strip punctuation/middle initials); require last name exact + first name fuzzy (Levenshtein ≤ 2 or matches nickname list).
   - Writes result into `vet_profiles` + inserts a `vet_verification_attempts` row.
   - `source_unavailable` → schedule retry (see below).

2. **`verify-vet-fear-free`** — same shape; scrapes the Fear Free directory searching by cert number + last name.

3. **`vet-verification-cron`** — invoked by a `pg_cron` job every hour. Retries all `pending_review` rows whose last attempt was `source_unavailable` and is > 6h old and < 72h old.

4. **State scraper library** (`supabase/functions/verify-vet-license/states/`)
   - Ship with the top ~10 states first (CA, TX, FL, NY, PA, OH, IL, GA, NC, WA), each as its own module with a `lookup(name, licenseNumber)` function.
   - Any state without a module returns `source_unavailable` → automatic `pending_review`. Roadmap covers the rest.
   - Use `fetch` directly; if a state needs JS rendering, fall back to a hosted headless-browser API (e.g. Browserless) — flagged with a secret we'd add later, not required for v1.

Robots/ToS: license lookup portals are public records. We still add a `User-Agent: HelpAPetVerifier/1.0` and rate-limit to 1 req/sec per state to be respectful.

## Backend — trigger

DB trigger on `vet_profiles` insert/update: when `license_number`, `license_state`, or `license_full_legal_name` changes → set `verification_status = 'pending'`, then a client-side/edge invocation fires `verify-vet-license`. (Triggers can't call HTTP; we invoke the function from the same code path that saved the profile, plus the cron catches any that slipped through and are still `pending` > 15 min.)

## Frontend — vet signup / profile form (`VetProfilePage`)

Add the required fields:
- Full legal name (defaults from user profile, editable)
- License state (dropdown of 50 states + DC)
- Veterinary license number
- Fear Free certificate number (optional)
- Fear Free credential upload stays (already supported)

Live status badge under the form: "Verifying…", "Verified ✓", "Pending review — we're double-checking with the state board", "Couldn't verify — please contact support". Clear language so users aren't blocked.

## Frontend — Admin Dashboard (`AdminVetProfilesPage` — extend existing admin vets view)

New table columns / detail card for each vet:
- Name, state, license number, license status text
- Fear Free status
- Verification date/time (per source)
- Last failure reason
- Source used + link (e.g. "CA Board of Veterinary Medicine — open lookup")
- Last 5 attempts (timestamp, status, http code)
- Actions: **Retry now**, **Mark verified (override)**, **Mark unverified (override)** — override sets `verification_status = 'manual_override'` and stamps `license_verified_by = auth.uid()`, matching the existing guard trigger.

## Secrets

None required for v1 (portals are public). If we later add Browserless for JS-heavy states we'll request `BROWSERLESS_TOKEN` via `add_secret`.

## Rollout / scope for this task

Because scraping 50 state boards is a big surface, this plan ships:

1. Schema + attempts table + RLS + trigger.
2. `verify-vet-license` framework with modules for **CA, TX, FL, NY, WA** (5 states covering ~35% of US vets). Others return `source_unavailable` → `pending_review`.
3. `verify-vet-fear-free` directory lookup.
4. Retry cron.
5. Vet-side form + status badge.
6. Admin dashboard verification panel + override.

Adding more states later is a copy-paste of a state module — no schema or UI changes needed.

## Open questions before I build

1. Do you want the vet to be **blocked from receiving tickets** until `verified` / `manual_override`, or just visibly flagged? (Current codebase already gates on `is_approved` + `is_license_verified`.)
2. Ship the 5-state MVP now and expand, or wait until we have all 50? (I recommend ship-and-iterate.)
3. Fear Free: do you already have an official partnership? If yes, they may give us a real API/CSV — please share the contact and I'll wire it in instead of scraping.
