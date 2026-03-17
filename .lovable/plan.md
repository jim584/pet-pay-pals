

## Plan: Replace Heart "Like" Icon with Praying Hands Emoji

The Heart icon used for likes across the app will be replaced with a custom praying-hands SVG icon that matches the uploaded reference image. Since Lucide doesn't have a praying hands icon, I'll create a reusable SVG component.

### Changes

**1. Create `src/components/icons/PrayingHands.tsx`**
- A custom SVG component mimicking the uploaded praying-hands icon
- Accepts `className` and standard SVG props (like Lucide icons do)
- Supports `fill-current` for the "liked" filled state

**2. Update 3 files to swap Heart → PrayingHands:**

- **`src/components/community/StoryCard.tsx`** — Story like button (line 170) and comment like button (line 316)
- **`src/components/home/PublicFeed.tsx`** — Public feed like button (line 186)
- **`src/components/home/StoryComments.tsx`** — Comment like button (line 262)

In each location, replace `<Heart>` with `<PrayingHands>` and update the color scheme from `text-destructive` (red) to a more fitting color like `text-amber-500` or `text-primary` for the "liked" state (praying hands look better in gold/amber than red). The outlined/filled toggle behavior stays identical.

