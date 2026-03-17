

## Plan: Link "Help A Pet Now" to Home Page

Update the CompassMenu so "Help A Pet Now" navigates to `/` (the home page) instead of `/help-now`.

### Changes

**`src/components/home/CompassMenu.tsx`** — Change the `to` value for "Help A Pet Now" from `"/help-now"` to `"/"`.

**`src/App.tsx`** — Remove the `/help-now` placeholder route since it's no longer needed.

