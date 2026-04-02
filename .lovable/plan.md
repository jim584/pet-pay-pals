

## Plan: Improve Mobile Bottom Navigation

Enhance the bottom nav with visual active indicators, smooth animations, and better interaction feedback.

### Changes

**`src/components/home/MobileBottomNav.tsx`**

1. **Active dot indicator** — Add a small colored dot below the active item's label for clear visual feedback
2. **Icon animation on active** — Scale up the active icon slightly (`scale-110`) with a spring-like transition
3. **Tap animation** — Add `active:scale-90` for tactile press feedback on all items
4. **Smooth transitions** — Apply `transition-all duration-200` for color, transform, and opacity changes
5. **Active state matching** — Use `startsWith` instead of exact match so `/dashboard/pets` stays active on sub-routes
6. **Active label styling** — Make active label bold (`font-semibold`) and slightly larger

### Visual Result

```text
 ┌──────────────────────────────────┐
 │  🏠      🧭      ❤️      🐾      👤  │
 │ Home  Explore  Help   Pets  Profile│
 │         ·               ●          │  ← dot under active
 └──────────────────────────────────┘
```

All changes are contained in the single `MobileBottomNav.tsx` file with Tailwind classes only — no additional CSS or dependencies needed.

