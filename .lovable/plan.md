## Goal
Owner-submitted tickets must reach the assigned vet, not just admin. Today the form has a free-text "Clinic name" input and never sends `vet_profile_id`, so the vet's "Incoming Tickets" page is always empty.

## Change

### `src/pages/VetTicketsPage.tsx`

1. In `OwnerVetTicketsView`, also load registered clinics:
   ```ts
   supabase.from("vet_profiles")
     .select("id, clinic_name, location")
     .eq("is_approved", true)
     .order("clinic_name")
   ```
   Pass `clinics` into `NewTicketDialog` alongside `pets`.

2. In `NewTicketDialog`, replace the free-text **Clinic name** input with a **Clinic selector**:
   - A `Select` listing every registered clinic (`clinic_name — location`), plus a final **"Other / not listed…"** option.
   - When a registered clinic is picked → submit with `vet_profile_id = clinic.id` and `clinic_name = clinic.clinic_name` (denormalized for display).
   - When "Other" is picked → reveal a text input for the clinic name; submit with `vet_profile_id = null` (admin-only review).
   - Helper text under the field explains: registered clinic = visible to that clinic + admin; Other = admin-only.

3. Toast message reflects routing:
   - Registered: "Sent to your clinic and our admin team for review."
   - Other: "Sent to our admin team for review (clinic isn't on Help A Pet yet)."

### Why this works
- `submit-vet-ticket` already accepts `vet_profile_id` and writes it to `vet_tickets.vet_profile_id`.
- RLS on `vet_tickets` already lets the matching vet (`is_vet_profile_owner(vet_profile_id, auth.uid())`) and admins read the row.
- `listTicketsForVet()` already filters by `vet_profile_id`, so once tickets carry that id, the vet's "Incoming Tickets" page populates automatically.

No DB or edge function changes required.

## Out of scope
- Searchable combobox (plain Select is fine for now; can upgrade if list grows).
- Notifying the vet by email — not requested.
