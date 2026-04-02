

## Plan: Make Header Non-Sticky

Remove the sticky positioning from the header in `HomePage.tsx`.

### Change

**`src/pages/HomePage.tsx` (line ~50)**
- Change `className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"` to `className="border-b bg-background"` — removing `sticky`, `top-0`, `z-40`, and the backdrop blur classes since they're only needed for sticky behavior.

Also update the sidebar `top-14` values to `top-0` since there's no sticky header to offset against.

