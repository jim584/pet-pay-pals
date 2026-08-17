# Future-Proof Vetted Affiliate Tracking (Compatibility Only)

## Goal
Ensure the current veterinarian profile and Vetted product architecture can support future Vetted affiliate attribution without building the affiliate system now.

## What is NOT being built
- Veterinarian affiliate dashboards
- Commission-calculation or payout logic
- Coupon-code functionality
- A separate Help a Pet affiliate program
- Click/purchase tracking tables or redirect service
- Any UI that exposes affiliate fields to users

## Changes

### 1. Reserve nullable affiliate fields on veterinarian profiles
Add two nullable columns to `public.vet_profiles`:
- `vetted_affiliate_id text` — the veterinarian's Vetted affiliate identifier.
- `vetted_affiliate_link text` — the full affiliate URL or link template.

These columns will be ignored by all current code and UI. They exist only so the future feature does not require a data migration or backfill.

### 2. Add a direct pet-to-vet-profile link
Currently `pets.vet_of_record_license_id` points to `vet_license_records`, which in turn links to `vet_profiles`. Add a nullable `pets.vet_profile_id` column referencing `vet_profiles(id) ON DELETE SET NULL`.

This creates a direct, stable "veterinarian of record" relationship that future attribution logic can use without joining through the license record table.

### 3. Update TypeScript interfaces (no UI usage)
- Extend `VetProfile` in `src/lib/vet-api.ts` to include `vetted_affiliate_id` and `vetted_affiliate_link` as nullable strings.
- Extend the `Pet` type/interface to include `vet_profile_id` as a nullable string.

No components will read or display these fields yet.

### 4. Make the product card accept an override shop URL
Refactor `src/components/vetted/ProductCard.tsx` so the CTA link can be supplied via an optional `shopUrl` prop, falling back to `product.external_url`.

This lets a future affiliate wrapper inject a computed URL (e.g., appended affiliate parameters or a redirect) without rewriting the card.

### 5. Document the future attribution model
Create `src/lib/vetted-affiliate.ts` as a stub/comment file that describes the intended future flow:

```text
Member selects / has a Pet with vet_profile_id (veterinarian of record).
That vet profile may have vetted_affiliate_id / vetted_affiliate_link.
When the member clicks a Vetted product, Help a Pet records:
  - member_id
  - pet_id
  - vet_profile_id
  - vetted_product_id / source_product_id
  - timestamp
The actual purchase attribution and commission are handled by Vetted;
Help a Pet only preserves the relationship.
Attribution applies only to the specific Vetted-approved product,
not to unrelated items purchased in the same session.
```

The file will contain no active runtime logic.

## Acceptance criteria
- `vet_profiles` has the two new nullable columns.
- `pets` has the new nullable `vet_profile_id` column.
- TypeScript types reflect the new fields.
- `ProductCard` renders identically and still links to `product.external_url` by default.
- No new UI, dashboard, commission, payout, or tracking logic is added.
- The app builds and existing tests pass.
