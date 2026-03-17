

## Plan: Add Search Bar and Category Filter Chips to the Home Page Feed

Replicate the community page's search bar and category filter tabs above the public feed on the home page, enabling client-side filtering of feed stories.

### Changes

**1. Update `FeedStory` type and query to include `category` (`src/lib/feed-api.ts`)**
- Add `category` field to the `FeedStory` interface
- Update the `fetchPublicFeed` select query to include `category`

**2. Add `search` and `category` props to `PublicFeed` (`src/components/home/PublicFeed.tsx`)**
- Accept optional `search` and `category` string props
- Filter `displayStories` client-side (same logic as `CommunityFeed`): match category, and match search term against title, content, pet name, and author name
- Also filter sample stories the same way

**3. Add search bar and category chips to `HomePage` (`src/pages/HomePage.tsx`)**
- Add `search` and `category` state
- Import `STORY_CATEGORIES` from `community-api`, `Input` and `Search` icon
- Render the search input (with search icon, rounded-full style) and category pill buttons above `<PublicFeed />`, matching the community page's styling
- Pass `search` and `category` as props to `<PublicFeed />`

### Files Modified
| File | Change |
|------|--------|
| `src/lib/feed-api.ts` | Add `category` to `FeedStory` interface and select query |
| `src/components/home/PublicFeed.tsx` | Accept `search`/`category` props, filter stories client-side |
| `src/pages/HomePage.tsx` | Add search + category filter UI, pass to `PublicFeed` |

