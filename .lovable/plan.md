

## Plan: Add Text Input for Mixed Breed Details

When the user selects "Mixed Breed" from the breed dropdown, show an additional text input below so they can describe the specific mix (e.g., "Golden Retriever / Poodle").

### Changes

**1. Update `BreedCombobox` component (`src/components/pets/BreedCombobox.tsx`)**
- Add an optional `onMixedBreedDetail` callback prop and `mixedBreedDetail` string prop
- When the selected value is "Mixed Breed", render a text input below the combobox button with placeholder "Describe the mix (e.g. Golden Retriever / Poodle)"

**2. Update `PetFormDialog.tsx`**
- Add a `mixedBreedDetail` state field (or extend the form state)
- Pass `mixedBreedDetail` and `onMixedBreedDetail` to `BreedCombobox`
- When saving, if breed is "Mixed Breed" and detail is provided, store breed as `"Mixed Breed - {detail}"` (or store detail in the breed field)
- Clear the detail when species or breed changes away from Mixed Breed

**3. Update `CreateAdoptionDialog.tsx`**
- Same pattern: add mixed breed detail state, pass to `BreedCombobox`, combine on save

### Technical Details

- The mixed breed detail input appears conditionally only when value === "Mixed Breed"
- Stored as a single string in the existing `breed` column: `"Mixed Breed - Golden Retriever / Poodle"`
- No database changes needed

