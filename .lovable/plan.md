

## Plan: Public Homepage with Instagram-Style Feed

This is a major architectural change — transforming the app from a login-gated dashboard into a public-first social platform where unlogged users can browse pet content.

### Current State
- `/` redirects to `/auth` if not logged in — no public content
- Community feed exists but only inside the authenticated `/dashboard/community` route
- No concept of "following" individual pets — only story posts exist
- No public pet profiles

### What Changes

**Database Migration**
- New `pet_follows` table (user_id, pet_id, unique constraint) with RLS: authenticated users can manage their own follows, public can read counts
- Add `followers_count` column to `pets` table (default 0)
- Trigger to auto-increment/decrement `followers_count` on follow/unfollow
- Add SELECT RLS policy on `pets`, `pet_stories`, `profiles` for anonymous (public) read access so unlogged users can see the feed

**New API Layer — `src/lib/feed-api.ts`**
- `fetchPublicFeed()` — fetch recent pet stories with pet + owner profile joins (no auth required)
- `fetchSuggestedPets()` — fetch pets ordered by followers_count desc, excluding already-followed
- `followPet(petId)` / `unfollowPet(petId)` — toggle follow
- `checkFollowing(petId)` — check if current user follows a pet
- `fetchPetProfile(petId)` — public pet profile with stats

**New Components**

1. `src/components/home/CompassMenu.tsx` — Left sidebar with 8 branded menu items in compass layout:
   - North: Help A Pet Now, South: Help A Pet Forever, East: Four Feet Under, West: FearFreed
   - NE: Help A Pet Overcome, NW: Help A Pet Protect, SE: Help A Pet Behave, SW: Vetted
   - Each item styled with icon + hover effect; links to placeholder routes for now

2. `src/components/home/PublicFeed.tsx` — Center column, Instagram-style card feed:
   - Pet avatar + name + owner name header
   - Photo carousel/grid
   - Like, comment, share, follow buttons
   - For unlogged users: buttons are visually disabled with tooltip "Log in to like and follow this pet"
   - Clicking disabled buttons redirects to `/auth`

3. `src/components/home/SuggestedPets.tsx` — Right sidebar:
   - List of pet profiles with avatar, name, breed
   - Follow button (disabled with CTA for unlogged users)

4. `src/components/home/PetProfilePreview.tsx` — Hover card showing pet bio, photo, follower count

5. `src/pages/HomePage.tsx` — New public homepage layout:
   - 3-column grid: CompassMenu (left, fixed ~240px) | PublicFeed (center, flex) | SuggestedPets (right, fixed ~280px)
   - Top bar with app logo + "Sign Up" / "Log In" buttons (for unlogged users) or user avatar (for logged users)
   - Responsive: on mobile, hide sidebars, show feed only with bottom nav

**Routing Changes — `src/App.tsx` & `src/pages/Index.tsx`**
- `/` renders `HomePage` for ALL users (logged or not) instead of redirecting
- Logged-in users see the same feed but with interactive buttons enabled
- Dashboard remains at `/dashboard` for account management, pets CRUD, wallet, etc.
- Add placeholder routes for the 8 compass menu sections

### Implementation Steps

1. Run database migration (pet_follows table, public read policies, followers_count on pets)
2. Create `feed-api.ts` with public feed queries and follow logic
3. Build `CompassMenu` component with compass-style layout
4. Build `PublicFeed` component with auth-aware interaction buttons
5. Build `SuggestedPets` sidebar component
6. Build `PetProfilePreview` hover card
7. Build `HomePage` with 3-column layout and top bar
8. Update routing: `/` shows HomePage for everyone, add compass section placeholder routes

### Technical Details

- Public read access uses Supabase anonymous role via RLS policies (`USING (true)` for SELECT on pets, pet_stories, profiles)
- `useAuth()` hook returns `user: null` for unlogged visitors — components check this to toggle interactivity
- Follow counts maintained via Postgres trigger (not app-side counting) to avoid race conditions
- Feed query: `pet_stories` joined with `pets(name, photo_url, species, breed)` and `profiles(full_name, avatar_url)`, ordered by `created_at desc`

