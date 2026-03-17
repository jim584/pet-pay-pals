

## Plan: Replace Age Input with Date of Birth Calendar Picker

Replace the manual "Age (years)" number input with a date of birth calendar picker. Age will be auto-calculated and displayed as "X years, Y months" everywhere.

### Database Migration

Add a `date_of_birth` column to the `pets` table:
```sql
ALTER TABLE public.pets ADD COLUMN date_of_birth date NULL;
```
The existing `age_years` column stays for backward compatibility (existing pets without a DOB).

### Helper Function

Create a utility `calculateAge(dob: string): { years: number; months: number }` in `src/lib/pets-api.ts` that computes years and months from a date of birth string.

### File Changes

| File | Change |
|------|--------|
| **DB migration** | Add `date_of_birth` column to `pets` table |
| `src/lib/pets-api.ts` | Add `date_of_birth` to `Pet` interface; add `calculateAge()` helper |
| `src/components/pets/PetFormDialog.tsx` | Replace the age number input with a date picker (Popover + Calendar). Auto-compute `age_years` from selected DOB before saving. Show computed age below the picker. |
| `src/components/pets/PetDetail.tsx` | Display age as "X yrs, Y mos" using `calculateAge()` when `date_of_birth` exists, fall back to `age_years` |
| `src/pages/PetsPage.tsx` | Update age display in pet cards to use `calculateAge()` when DOB is available |

### UX Details

- Date picker uses the existing Shadcn Calendar + Popover pattern with `pointer-events-auto`
- Calendar is constrained: no future dates allowed
- After selecting a DOB, a read-only line shows "Age: 3 years, 7 months" below the picker
- When saving, `age_years` is also computed and stored for backward compatibility
- Existing pets without a DOB continue showing their stored `age_years`

