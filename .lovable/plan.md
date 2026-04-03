

## Plan: Replace All Logo Variants Globally

Copy the uploaded logo to replace all three logo asset files used across the app.

### Changes

1. **Replace asset files** -- Copy `user-uploads://Y-logo-color-8EWaqXTU.png` to:
   - `src/assets/logo-color.png` (used in HomePage header + Auth page)
   - `src/assets/logo-dark.png` (used in Dashboard sidebar)
   - `src/assets/logo-light.png` (unused currently, but kept consistent)

No code changes needed -- the imports already reference these filenames.

