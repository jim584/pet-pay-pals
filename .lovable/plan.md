

## Plan: Add Suggested Pets sidebar to Help A Pet Forever page

Mirror the HomePage's 3-column layout on the HelpForeverPage, adding the `SuggestedPets` sidebar on desktop and `MobileSuggestedPets` horizontal scroller on mobile.

### Changes

**`src/pages/HelpForeverPage.tsx`**

1. Import `ScrollArea`, `SuggestedPets`, `MobileSuggestedPets`, and `CompassMenu`
2. Convert the current single-column `<main>` into a 3-column flex layout (matching HomePage):
   - **Left sidebar** (desktop only, w-60): `CompassMenu` for explore/navigation
   - **Center column** (flex-1): Current content (hero, search, tabs, listings)
   - **Right sidebar** (desktop only, w-72): `SuggestedPets`
3. On mobile: render `MobileSuggestedPets` at the top of the center content (above the hero banner)
4. Update `max-w-4xl` to `max-w-7xl` on the outer wrapper to accommodate the 3-column layout

No new files or database changes needed — purely reusing existing components.

