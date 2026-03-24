

## Fix: Reaction Picker Emoji Popup Getting Clipped

### Problem
The reaction picker popup appears inside Card components that have `overflow-hidden`, which clips the emoji popup since it uses `absolute` positioning to render above the button.

### Solution
Change the reaction picker popup to use a **React Portal** so it renders at the document body level, outside any `overflow-hidden` containers. The popup position will be calculated dynamically based on the trigger button's screen coordinates.

### Changes

**File: `src/components/shared/ReactionPicker.tsx`**
- Import `createPortal` from `react-dom`
- Add a ref to track the main button element's position
- Use `getBoundingClientRect()` to calculate popup position on show
- Render the picker popup via `createPortal(…, document.body)` with `fixed` positioning instead of `absolute`
- Position it above the button using the calculated coordinates

This is a single-file fix that resolves the clipping across all feed cards (PublicFeed, StoryCard, CommunityFeed) without needing to remove `overflow-hidden` from any Card components.

