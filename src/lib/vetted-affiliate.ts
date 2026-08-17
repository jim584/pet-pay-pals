// Future Vetted Affiliate Tracking — Architecture Stub
//
// This file documents the intended future attribution model. It is NOT
// implemented yet and contains no active runtime logic.
//
// Intended future flow:
//   1. A member has one or more Pets.
//   2. A Pet has a direct veterinarian-of-record link via `pets.vet_profile_id`
//      (and, indirectly, via `pets.vet_of_record_license_id` ->
//      `vet_license_records.vet_profile_id`).
//   3. The linked `vet_profiles` row may store:
//        - `vetted_affiliate_id`   : the veterinarian's Vetted affiliate identifier
//        - `vetted_affiliate_link` : a full affiliate URL or link template
//   4. When a member clicks a Vetted-approved product from Help a Pet,
//      the app will record the attribution relationship:
//        - member_id
//        - pet_id
//        - vet_profile_id
//        - vetted_product_id / source_product_id
//        - timestamp
//   5. The actual purchase attribution, commission calculation, and veterinarian
//      payout will be handled by Vetted or the applicable external system.
//   6. Help a Pet's responsibility is limited to preserving the relationship
//      between Member + Veterinarian of Record + Veterinarian's Vetted Affiliate
//      ID + the relevant Vetted Product Purchase.
//   7. Attribution applies only to the specific Vetted-approved product. Unrelated
//      products purchased from the external retailer during the same session do
//      not generate veterinarian commissions.
//
// Implementation checklist for when this feature is approved:
//   [ ] Create a `vetted_product_clicks` (or similar) table for attribution rows.
//   [ ] Add vet-facing UI on VetProfileSetup to enter affiliate ID/link.
//   [ ] Add member-facing UI to select/confirm a veterinarian of record for a pet.
//   [ ] Compute the final affiliate URL in ProductCard via a `shopUrl` prop.
//   [ ] Build an edge function or service hook to notify Vetted of attributed
//       clicks/purchases, if Vetted provides an endpoint.
//
// Current compatibility steps already taken:
//   - `vet_profiles.vetted_affiliate_id` and `vetted_affiliate_link` exist as
//     nullable columns.
//   - `pets.vet_profile_id` exists as a nullable direct link to `vet_profiles`.
//   - `ProductCard` accepts an optional `shopUrl` prop, defaulting to the
//     product's external_url.

export {};
