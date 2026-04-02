

## Plan: Make Dialogs Responsive on All Screen Sizes

The core issue is that dialogs (especially tall ones like "Add Pet") get cut off on small screens because the `DialogContent` component uses `fixed` centering without height constraints or scrolling.

### Changes

**1. `src/components/ui/dialog.tsx` — Make DialogContent mobile-friendly**
- Add `max-h-[85vh] overflow-y-auto` to ensure content scrolls when it exceeds viewport height
- Add `mx-4` margin on mobile so the dialog doesn't touch screen edges
- Reduce padding on mobile from `p-6` to `p-4 sm:p-6`

**2. `src/components/pets/PetFormDialog.tsx` — Tighten spacing on small screens**
- Reduce avatar size on mobile (`h-16 w-16` instead of `h-20 w-20`)
- Stack the 2-column grids (species/breed, DOB/weight) into single columns on very small screens using `grid-cols-1 sm:grid-cols-2`

**3. Other dialog consumers** — Several already have `max-h-[85vh] overflow-y-auto` (CreateAdoptionDialog, TrainingBlog, CreateProductDialog). The ones that don't (AddHealthRecordDialog, AddEmergencyContactDialog, VetServicesPage, StoryCard donate dialog, HelpOvercomePage dialogs) will inherit the fix from the base DialogContent component.

### Summary of Impact
- All dialogs across the app will automatically become scrollable on small screens
- No content will be cut off regardless of device size
- The "Add Pet" form specifically gets tighter spacing on mobile for better usability

