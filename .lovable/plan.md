

## Plan: Help A Pet Protect — Abuse & Neglect Stories Feed

Build a new page at `/help-protect` that displays a feed of stories about animal abuse and neglect. The feed reuses the existing `pet_stories` infrastructure, filtering by a new `"protection"` category.

### Changes

**1. Add "protection" category to `src/lib/community-api.ts`**
- Add `{ value: "protection", label: "Protection", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }` to `STORY_CATEGORIES`.

**2. Create `src/pages/HelpProtectPage.tsx`**
- New page similar to `HelpForeverPage` structure: sticky header with back button, hero banner (themed around reporting abuse/neglect), search bar, and a single-column feed.
- Fetches stories from `pet_stories` filtered by `category = 'protection'`.
- Uses the existing `StoryCard` component for rendering each post (same social-feed style with likes, comments, donate).
- Includes a "Share Story" button that opens `CreateStoryDialog` with category pre-set to `"protection"`.
- Pagination via `useInfiniteQuery` with "Load More" button.

**3. Create `src/lib/protection-api.ts`**
- `fetchProtectionStories(page, searchQuery)` — queries `pet_stories` where `category = 'protection'`, with optional ilike search on title/content/pet name, ordered by `created_at desc`, paginated.

**4. Update `src/App.tsx`**
- Replace the `/help-protect` placeholder route with the new `HelpProtectPage` component.

**5. Update `src/components/community/CreateStoryDialog.tsx`**
- Accept an optional `defaultCategory` prop so the Help Protect page can pre-select "protection" when creating stories.

No database changes needed — the existing `pet_stories.category` text column already supports any string value.

