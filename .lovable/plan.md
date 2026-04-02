

## Plan: Fix Mouse Wheel Scrolling in Breed Dropdown

The previous fix consolidated scroll containers, but the `cmdk` library can still intercept wheel events. The fix is to add an explicit `onWheel` event handler on the `CommandList` to ensure native scrolling works, and add `overscroll-behavior-contain` to prevent scroll leaking.

### Changes

**`src/components/pets/BreedCombobox.tsx`**
- Add an `onWheel` handler to the `CommandList` that calls `e.stopPropagation()` to prevent cmdk from swallowing wheel events
- Add `overscroll-contain` class to keep scroll contained within the list

Single file change, ~3 lines added.

