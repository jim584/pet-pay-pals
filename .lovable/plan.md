

## Plan: Single-Column Blog Layout for FearFreed™

Change the blog post grid in `src/pages/FearFreedPage.tsx` from a 2-column layout to a single-column layout, matching the social-media-style feed pattern used elsewhere in the app.

### Change
In `FearFreedPage.tsx`, update the grid class from `grid-cols-1 sm:grid-cols-2` (or similar) to always use a single column, centered with a max-width for readability:

```tsx
// Before
<div className={`grid gap-5 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>

// After
<div className="grid grid-cols-1 gap-5 max-w-2xl mx-auto">
```

One file changed: `src/pages/FearFreedPage.tsx`.

