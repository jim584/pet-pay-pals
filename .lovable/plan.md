# Veterinarian License Database (Point #1: data acquisition, filtering, storage, sync, lookup)

Build one centralized, regularly-refreshed table of **active, standard Veterinary License** records for all 50 states + DC, and make it the authoritative source for vet signup verification, member vet search, and vet-of-record selection.

Scope note: selfie / manual account verification is explicitly out of scope here (Point #2). Merchant ID is **not** stored in the license database — it stays on the vet's account, captured at signup.

## What gets built

### 1. License data store
A new `vet_license_records` table holding one row per state license:
- veterinarian name (full, plus normalized first/last for matching)
- state, license number, license status, license type
- address (street/city/state/zip), phone
- source authority name + source URL
- issue/expiration dates where the state provides them
- `source_synced_at` (when the state published it) and `last_synced_at` (when we imported it)
- `is_active` flag, unique on (state, license_number)

Ingestion filters, applied at import time and enforced again on write:
- keep only records whose status normalizes to **active/current**
- keep only the **standard Veterinary License** type — technician, specialty, medication-clerk, temporary/intern, and facility/premise permits are dropped
- rows that disappear from a newer full snapshot are marked inactive rather than deleted (so historical tickets keep their reference)

### 2. Source registry per jurisdiction
A `vet_license_sources` table (one row per state + DC) recording: import method (`api`, `bulk_file`, `manual_upload`, `none_yet`), source URL, expected file format, refresh cadence, whether automated sync is enabled, last successful sync, last error, and the field-mapping config used by the parser. This replaces guesswork with a per-state config an admin can see and change.

### 3. Import pipeline
One edge function, `import-vet-licenses`, that runs a single state's import end to end:
- fetch (API or bulk file URL) **or** accept an admin-uploaded file
- parse CSV / fixed-width / XLSX / JSON via the state's mapping config
- normalize status + license type, apply the active/standard filters
- upsert on (state, license number), mark missing rows inactive for full snapshots
- write a run record to `vet_license_import_runs` (rows read, kept, filtered out, inserted, updated, deactivated, errors)

Automated states run on a schedule (weekly by default, per-state override); manual states are refreshed by an admin upload. Every path uses the same parser + filter code, so a manual upload produces the same data quality as an API sync.

### 4. Admin console
A new **Vet License Database** admin page:
- per-state table: method, records held, last sync, staleness badge, last error
- "Sync now" for automated states, "Upload file" (drag-drop CSV/XLSX) for manual states, with a preview of what will be kept vs filtered before commit
- import run history with counts and downloadable error rows
- record search across all states

### 5. Platform lookups that consume it
- **Vet signup**: license number + state are checked against the database; exact active match with a name match auto-verifies, mismatch or state-not-yet-loaded goes to `pending_review` (never auto-reject).
- **Member vet search / vet-of-record**: typeahead searching the license database by name, clinic city, or license number, scoped by state. Selecting a licensed vet who has no platform account still establishes a vet of record, and links automatically to their `vet_profiles` row when they register.
- Existing `verify-vet-license` function gains a database-first step: check the local table before attempting any live source; only fall back to live lookups when the state has no loaded data.

### 6. Rollout order for states
1. Ship the schema, pipeline, and admin console with **manual upload working for all 51 jurisdictions** — that alone makes every state usable on day one.
2. Wire automated bulk-file sync for states that publish a downloadable roster (Florida DBPR weekly file first, then Louisiana, Maryland, New York).
3. Add API/live sync per state as sources are confirmed permitted, one state at a time behind the existing per-state flag.

## Technical details

- Tables: `vet_license_records`, `vet_license_sources`, `vet_license_import_runs`. All in `public` with GRANTs; records readable by authenticated users (needed for vet search), writable only by service role; sources and runs admin-only.
- Indexes: unique `(state, license_number)`; trigram/`tsvector` index on normalized name for typeahead; index on `(state, is_active)`.
- Storage: private `vet-license-imports` bucket for uploaded source files, retained for audit.
- Parsers live in `supabase/functions/import-vet-licenses/parsers/`, one module per format, driven by the per-state mapping config so new states need config, not code, in the common case.
- Status/type normalization is shared code with unit tests over sanitized fixtures; no raw source HTML is persisted.
- Scheduling via a cron-invoked `sync-vet-licenses` function that iterates enabled sources and calls the importer.
- Merchant ID stays on `vet_profiles`; no merchant field is added to license records.
