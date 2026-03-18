

## Plan: Facebook/Instagram-Style Photo Grid

Replace the carousel with a photo grid layout that adapts based on the number of images, similar to Facebook and Instagram.

### Grid Layouts

```text
2 photos:  [  1  ] [  2  ]     (side by side, equal)
3 photos:  [   1   ] [ 2 ]     (1 large left, 2 stacked right)
           [       ] [ 3 ]
4+ photos: [ 1 ] [ 2 ]         (2x2 grid, last cell shows "+N" overlay if >4)
           [ 3 ] [ 4 ]
```

### Changes

**1. `src/components/home/PublicFeed.tsx`**
- Replace `FeedCarousel` component with a new `PhotoGrid` component
- Grid uses CSS grid with `gap-0.5` (thin gap like Instagram)
- Each image is clickable for the existing lightbox
- For 5+ photos, the 4th cell gets a dark overlay with "+N more"
- Maintain the 4:3 aspect ratio for the overall grid container

**2. `src/components/community/StoryCard.tsx`**
- Replace `StoryCarousel` with the same grid pattern
- Reuse identical layout logic adapted to the card's styling (rounded corners, margins)

### Technical Details

- Pure CSS Grid with Tailwind classes (`grid grid-cols-2`, `row-span-2`, etc.)
- No new dependencies needed — removes carousel dependency from both files
- Images use `object-cover` to fill grid cells cleanly
- "+N" overlay: absolute-positioned div with `bg-black/50 text-white`

