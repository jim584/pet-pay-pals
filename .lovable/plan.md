

## Problem

The homepage is slow to load because:

1. **Failed API calls cause delay**: The `fetchPublicFeed()` and `fetchSuggestedPets()` queries are returning 400 errors (foreign key relationships `author_id` and `owner_id` don't exist in the database schema). React Query retries these failed requests multiple times before giving up, adding significant delay before the sample/fallback data appears.

2. **Large Unsplash images**: The 6 sample stories each load full-resolution images from Unsplash, which adds to perceived slowness.

## Plan

### 1. Fix the slow fallback — skip the failing API call gracefully

In `feed-api.ts`, wrap `fetchPublicFeed` and `fetchSuggestedPets` to catch errors and return empty arrays instead of throwing. This prevents React Query from retrying 3+ times on each failed request.

Alternatively (and better), configure React Query in `PublicFeed` to use `retry: false` for these queries, and set a short `staleTime`.

### 2. Show sample data immediately while API loads

In `PublicFeed.tsx`, change the loading state to show the sample stories right away instead of skeleton placeholders. The component already falls back to `SAMPLE_STORIES` when `stories.length === 0`, but currently shows pulsing cards during the loading + retry period.

- Set `retry: false` and `retryOnMount: false` on the `publicFeed` query
- Use `placeholderData: []` so the fallback sample data renders instantly
- Do the same for the suggested pets query in `SuggestedPets.tsx`

### 3. Optimize sample images

Add smaller dimensions to the Unsplash URLs (already using `w=800` which is reasonable, but add `q=75` for quality reduction).

### Summary of file changes

- **`src/components/home/PublicFeed.tsx`**: Add `retry: false` to the query config so failed DB queries don't cause multi-second delays. Show sample data during loading instead of skeletons.
- **`src/components/home/SuggestedPets.tsx`**: Same `retry: false` fix.
- **`src/lib/feed-api.ts`**: Catch errors and return `[]` instead of throwing, so fallback data kicks in immediately.

