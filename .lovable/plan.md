

## Plan: Fix Breed Dropdown Mouse Scroll

The breed dropdown in the "Add Pet" dialog has a scroll issue. The `CommandGroup` in `BreedCombobox` has `max-h-60 overflow-y-auto` while the parent `CommandList` also has `max-h-[300px] overflow-y-auto`, creating nested scrollable containers that conflict with mouse wheel scrolling.

### Changes

**`src/components/pets/BreedCombobox.tsx`**
- Remove `max-h-60 overflow-y-auto` from the `CommandGroup` — let the parent `CommandList` handle scrolling
- Add `max-h-60` to the `CommandList` instead (via className prop) to keep the dropdown a reasonable height

This ensures a single scrollable container that responds properly to mouse wheel events.

