

## Plan: Use Breed List for Searchable Breed Dropdown

Use the uploaded breed data to replace the free-text breed input with a searchable, species-aware dropdown in the pet registration form.

### What Changes

**1. Create a breed data file -- `src/lib/breeds.ts`**
- Export two arrays: `DOG_BREEDS` (~200 entries) and `CAT_BREEDS` (59 entries) extracted from the PDF
- Export a helper `getBreedsForSpecies(species: string)` that returns the appropriate list (or empty array for bird/rabbit/other)

**2. Update `src/components/pets/PetFormDialog.tsx`**
- Replace the plain `<Input>` for breed with a searchable combobox (using the existing `Command` + `Popover` components from shadcn/ui)
- When species is "dog" or "cat", show the filtered breed list as the user types
- For other species (bird, rabbit, other), keep the free-text input since we don't have breed data
- When species changes, clear the breed field to avoid mismatched data
- Allow users to type a custom breed not in the list (in case something is missing)

### Technical Details

- No new dependencies -- uses existing `Command`, `Popover`, `CommandInput`, `CommandItem` components already in the project
- Breeds are stored as a static TypeScript file (no database table needed)
- The combobox filters breeds client-side as the user types, showing matching results
- Approximately 260 breeds total, small enough to bundle statically

