

## Community Section UI/UX Improvements

After reviewing the code, I can identify several UI/UX issues with the current Community section:

1. **Empty state is bland** -- just a paw icon and text in a plain card
2. **Story cards lack visual polish** -- no rounded images, flat layout, cramped spacing
3. **No max-width constraint** -- stories stretch full width on large screens, making them hard to read
4. **Comments section feels unfinished** -- no empty state, no visual separation between comments
5. **Donate dialog is minimal** -- could use better visual hierarchy
6. **Loading state is just text** -- no skeleton placeholders
7. **Page header lacks personality** -- plain text with no visual flair

### Changes

**1. CommunityPage.tsx -- Better header with gradient accent and max-width container**
- Add a gradient accent banner or subtle background to the header area
- Constrain content width with `max-w-2xl mx-auto` for a social-feed feel (like Instagram/Twitter)
- Add a descriptive icon alongside the heading

**2. CommunityFeed.tsx -- Major visual overhaul of StoryCard**
- Add `max-w-2xl mx-auto` wrapper for feed-style centering
- **Loading state**: Replace text with 3 skeleton card placeholders (pulsing cards with fake image/text blocks)
- **Empty state**: More engaging design with a larger illustration area, gradient text, and a CTA button
- **Story cards**:
  - Move author avatar/info above the image (social media pattern: avatar + name + timestamp on top)
  - Round the card corners more, add subtle hover shadow
  - Better photo grid: rounded corners inside card, proper aspect ratios
  - Action bar: cleaner spacing, subtle background strip, rounded pill-style buttons for like/comment/donate
  - Comments: add rounded bubble styling per comment, better empty-comments message, smooth expand animation
  - Donate button: accent gradient styling to stand out

**3. CreateStoryDialog.tsx -- Minor polish**
- No major changes needed, already decent

### Technical Details

All changes are purely CSS/Tailwind and minor JSX restructuring in two files:
- `src/pages/CommunityPage.tsx` -- wrap content in max-width container, enhance header
- `src/components/community/CommunityFeed.tsx` -- skeleton loading, improved card layout, better action bar styling, comment bubbles, enhanced empty state

No database or API changes required.

