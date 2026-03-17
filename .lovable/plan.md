

## Plan: Single-Column Layout for Adoption Feed

The adoption cards currently display in a 2-column grid (`grid-cols-1 sm:grid-cols-2`). The user wants a single-column layout — one post per line, like a social feed.

### Change

**`src/pages/HelpForeverPage.tsx`** — Change the grid from `grid-cols-1 sm:grid-cols-2` to just `grid-cols-1` with a max-width constraint so cards don't stretch too wide on desktop. Center the feed.

**`src/components/adoption/AdoptionCard.tsx`** — Adjust the card to a horizontal layout on larger screens (image on the left, details on the right) to better use the single-column width.

