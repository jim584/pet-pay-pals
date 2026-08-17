# Vetted-Approved Products: Mirror, Not a Store

## Current state (verified in the code)

The Vetted section today is effectively a self-maintained Help a Pet catalog: `vetted_products` rows are inserted by any signed-in user through "List a product", and each user can edit or delete their own rows. There is no link back to a Vetted source record and no approval concept. That is exactly the duplication problem to remove.

## What this changes

Vetted becomes a **read-only mirror of the Vetted ecosystem's approved catalog** inside Help a Pet. Help a Pet stores a synchronized copy for browsing speed and offline resilience, but the source of truth for which products are approved stays with Vetted. No merchandise store, no independent catalog, no recreation of the Vetted website.

### 1. Retire member-submitted products

- Remove the "List a product" dialog and the member insert/update/delete paths.
- Nothing in the app can create a Vetted product by hand except an admin-run import, and every imported row is marked with the source it came from.
- Existing rows are preserved but tagged `source: 'legacy_manual'` and hidden from the public grid by default, so the live section only ever shows Vetted-approved items. You can decide later whether to delete them.

### 2. Mirror schema

`vetted_products` gains the fields a synced catalog needs:

- `source` (which system supplied the row) and `source_product_id` (the Vetted-side identifier), unique together so re-syncing updates rather than duplicates.
- `approved` / `approval_status` and `approved_at` — only approved rows render.
- `brand`, `currency`, `price_amount`, `sku`, `tags`, `raw_payload` (the untouched Vetted record), `synced_at`, `delisted_at`.
- Public read is restricted to approved, non-delisted rows. Writes are admin/service-role only.

A `vetted_sync_runs` table records each import: source, mode, counts of created / updated / delisted / skipped rows, errors, and who ran it.

### 3. Pluggable ingestion — no permanent method invented

An adapter layer sits between "whatever Vetted sends" and the mirror table. One normalizer maps an incoming product record to Help a Pet's shape; each adapter only has to produce that record.

Shipping now (works without any decision from Vetted):

- **Admin file import** — upload a CSV/JSON/XLSX export of the approved catalog, preview the column mapping, then commit. Same import-run reporting pattern already used by the vet license database.

Stubbed, disabled, and clearly marked "pending Vetted decision":

- **HTTP feed adapter** — a config row holding a feed URL plus credentials, with a "Test connection" action. Nothing runs on a schedule and no endpoint is hardcoded until Vetted confirms the method.

Whichever method Vetted finally chooses (API pull, feed URL, push webhook, direct DB replication) plugs in as one more adapter behind the same normalizer — no rework of the storefront or schema.

### 4. Sync semantics

- Products present in the incoming payload are upserted on `(source, source_product_id)`.
- Products missing from a full-catalog sync are marked delisted rather than deleted, so history and any linked references survive.
- Each product card shows a "Vetted-approved" badge and a "last synced" timestamp; the section header states that approval is determined by Vetted.

### 5. Presentation

The Help a Pet layout stays Help a Pet's own — existing grid, search, category tabs, "Shop Now" to the retailer. Categories are driven by whatever Vetted supplies, with unmapped values falling into "General". Empty state reads "The Vetted catalog hasn't been synced yet" instead of inviting members to add products.

### 6. Admin surface

A new admin page: sync status (source, last run, row counts), the file-import dialog, the disabled feed configuration, a searchable product table with approve/hide overrides for emergencies, and the run history.

## Explicitly out of scope

No veterinarian affiliate attribution, commissions, payouts, coupon codes, or any other affiliate mechanics. No checkout inside Help a Pet — purchases continue on the retailer's site.

## Technical notes

- Migration: alter `vetted_products` (new columns, unique index, tightened RLS + GRANTs), create `vetted_sync_runs` and `vetted_sync_config`.
- New edge function `import-vetted-products` handles parsing, normalization, upsert and delisting, and writes the run record; the disabled feed adapter lives in the same function behind a mode flag.
- Frontend: `vetted-api.ts` loses the create/delete calls and filters to approved rows; `CreateProductDialog` is removed; new `AdminVettedCatalogPage` plus an import dialog.

## Open item for Ryan

The plan needs Vetted to confirm the delivery method (API, feed, push, or replication) and the field list of an approved-product record. Until then the file import keeps the section populated and correct.
