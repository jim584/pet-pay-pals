

## Plan: Add Gender Field to Pet Profiles

The adoption form already has a gender field, but the pet profile form (`PetFormDialog`) and the `pets` database table do not. This plan adds gender support to pet profiles for consistency.

### Changes

**1. Database migration**
- Add a `gender` text column (nullable) to the `pets` table

**2. Update `src/components/pets/PetFormDialog.tsx`**
- Add a `gender` field to the form state (default empty string)
- Add a `Select` dropdown with options: Male, Female
- Include gender in the save payload

**3. Update `src/components/pets/PetDetail.tsx`**
- Display the pet's gender in the detail view if set

No changes needed to `CreateAdoptionDialog` — it already has the gender field.

