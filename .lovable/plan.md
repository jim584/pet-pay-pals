

## Plan: Restyle Protection Feed to Instagram-like Layout

The current `StoryCard` has rounded card borders, inline margins on photos, and pill-shaped action buttons. To match Instagram's feed style, the cards need to be flatter with edge-to-edge images and a cleaner action bar.

### Changes to `src/components/community/StoryCard.tsx`

1. **Remove card border rounding and shadow** — use flat cards with subtle bottom border only (no rounded-2xl, no shadow)
2. **Edge-to-edge photos** — remove `mx-3 rounded-xl` margins on images so they span the full card width, no border radius. Single images get full width, multi-images stay in a grid but flush
3. **Author header** — tighten to Instagram style: smaller avatar (h-8 w-8), bold username, subtle "more" menu, remove ring styling
4. **Action bar** — icon-only row (like, comment, donate/share) left-aligned without pill backgrounds, just icon buttons. Like count and comment count displayed as text below the icons
5. **Caption area** — show author name bold inline with content text (Instagram pattern: **username** caption text), move title into this format
6. **Time stamp** — show as relative time ("2h ago") in muted small text below caption

### Changes to `src/pages/HelpProtectPage.tsx`

7. **Tighten feed gap** — reduce gap between cards, remove `max-w-2xl` constraint to let cards fill the `max-w-4xl` container (or keep narrower ~max-w-lg for true IG feel)
8. **Remove hero banner padding/border-radius on mobile** for a cleaner top section

### No database or API changes needed.

