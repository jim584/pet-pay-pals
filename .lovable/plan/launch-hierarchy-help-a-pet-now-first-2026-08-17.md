# Launch Hierarchy: Help a Pet Now First

Simplify the launch experience so Help a Pet Now is clearly the primary area, with Help a Pet Forever, Furensic Files, and Vetted as the other primary areas.

## Primary navigation (4 areas)

1. Help A Pet Now (`/`) — main social/community layer, visually emphasized as the current/home area
2. Help A Pet Forever (`/help-forever`)
3. Furensic Files (`/four-feet-under`, renamed label)
4. Vetted (`/vetted`)

## Changes

**Compass menu (left sidebar)**
- Reduce to the four primary areas, with Help a Pet Now styled as the lead item (larger tile, accent treatment, short "community feed" subtitle).
- Rename "Four Feet Under" to "Furensic Files" in the menu label and page title.
- Remove Help A Pet Overcome, Help A Pet Behave, FearFreed, and Help A Pet Protect from the visible menu. Their routes and pages stay untouched and remain reachable by direct URL.
- Drop the compass direction labels (N/S/E/W) since only four items remain.

**Mobile bottom nav**
- Items become: Now (`/`), Forever (`/help-forever`), Furensic (`/four-feet-under`), Vetted (`/vetted`), Profile.

**Help a Pet Together**
- New route `/together` with a marketing landing page: what the membership is, how it works, benefits summary, and a clear call to action linking to the existing `/plans` signup flow.
- Together is not added to the primary navigation; it is linked from the home sidebar/footer area as a membership callout.
- No changes to membership, billing, or plan logic.

**Home page emphasis**
- Keep the feed as the main column and label it clearly as Help A Pet Now so the initial experience points at the community layer.

## Technical notes

- Files: `src/components/home/CompassMenu.tsx`, `src/components/home/MobileBottomNav.tsx`, `src/pages/HomePage.tsx`, `src/App.tsx` (add `/together` route), new `src/pages/TogetherPage.tsx`.
- `/four-feet-under` currently renders `PlaceholderSection title="Four Feet Under™"`; only the title string changes to `Furensic Files™`. No new Furensic functionality in this scope.
- No campaign, funding, priority, verification, or donation logic is added or altered here.
