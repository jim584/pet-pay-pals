

## Plan: Add Horse Breeds to Species Selection

Add "Horse" as a species option alongside Dog and Cat, with 130 searchable horse breeds extracted from the uploaded PDF.

### Changes

**1. Update `src/lib/breeds.ts`**
- Add a `HORSE_BREEDS` array with all 130 breeds from the PDF (American Quarter Horse through Yunnan Horse)
- Update `getBreedsForSpecies` to return `HORSE_BREEDS` when species is `"horse"`

**2. Update `src/components/pets/PetFormDialog.tsx`**
- Add `<SelectItem value="horse">Horse</SelectItem>` to the species dropdown (alongside dog, cat, bird, rabbit, other)

**3. Update `src/components/adoption/CreateAdoptionDialog.tsx`**
- Add `<SelectItem value="horse">Horse</SelectItem>` to the species dropdown (alongside dog, cat, other)

Both forms already use `getBreedsForSpecies` + `BreedCombobox` conditionally, so once the breeds data is in place, the searchable breed dropdown will automatically appear when "Horse" is selected.

