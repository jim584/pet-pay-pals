

## Plan: Replace Custom Praying Hands PNG with Standard Emoji

### Problem
The "pray" reaction uses a custom PNG image (`praying-hands.png`) that looks inconsistent with the other emoji reactions. It should use the standard 🙏 emoji like the rest.

### Changes

**1. `src/components/shared/ReactionPicker.tsx`**
- Remove the `PrayingHands` import
- Remove all conditional branches that check `r.key === "pray"` or `reaction.key === "pray"` and render `<PrayingHands />`
- Use the same emoji rendering (`<span>` with `r.emoji` / `reaction.emoji`) for all reactions including pray
- For the default (no reaction) state, render 🙏 as a plain emoji span with reduced opacity instead of the PrayingHands component

**2. `src/components/shared/ReactionSummary.tsx`**
- Remove the `PrayingHands` import
- Remove the conditional branch for `r.key === "pray"` — just render `r.emoji` for all reaction types uniformly

**3. `src/components/community/StoryCard.tsx`**
- Remove the unused `PrayingHands` import

**4. `src/components/icons/PrayingHands.tsx`** — Delete this file (no longer needed)

**5. `src/assets/praying-hands.png`** — Delete this file (no longer needed)

No changes needed to `src/lib/reactions.ts` — it already has `emoji: "🙏"` for the pray reaction.

