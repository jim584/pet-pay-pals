

## Plan: Photo Carousel on Feed Cards

Currently both `PublicFeed.tsx` (home page) and `StoryCard.tsx` (community page) only show the first photo or a simple grid. We'll add a swipeable carousel with dot indicators when a story has multiple photos.

### Changes

**`src/components/home/PublicFeed.tsx`** (lines 174-183)
- Replace the single `<img>` with an Embla carousel when `photo_urls.length > 1`
- Keep single-image rendering unchanged for posts with 1 photo
- Add dot indicators below the image for navigation
- Each slide uses `AspectRatio` with the same 4:3 ratio, clickable for fullscreen

**`src/components/community/StoryCard.tsx`** (lines 120-128, the photo grid section)
- Replace the current grid layout with the same carousel component when multiple photos exist
- Keep single-image display as-is
- Add dot indicators and swipe support

**Shared carousel pattern** (inline in each component, using existing `Carousel` components):
```
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel"
```
- Track active slide index via `CarouselApi` for dot indicators
- Render dots as small circles below the image area
- No prev/next arrows (swipe-only for clean mobile UX)

### Visual Design
- Dot indicators: small circles centered below image, active dot uses `bg-primary`, inactive `bg-muted-foreground/30`
- Smooth swipe transitions via Embla defaults
- Maintains existing aspect ratios and click-to-fullscreen behavior

