

## Threaded Comment Replies

Add the ability for users to reply to specific comments, displayed in a nested/indented style.

### 1. Database Migration

Add a nullable `parent_comment_id` column to `story_comments` with a self-referencing foreign key. When a parent comment is deleted, cascade-delete its replies.

```sql
ALTER TABLE public.story_comments
ADD COLUMN parent_comment_id uuid REFERENCES public.story_comments(id) ON DELETE CASCADE DEFAULT NULL;
```

### 2. API Layer (`src/lib/community-api.ts`)

- Update the `StoryComment` interface to include `parent_comment_id: string | null`.
- Update `addComment` to accept an optional `parentCommentId` parameter.
- Update `fetchComments` query to also select `parent_comment_id`.

### 3. Comment UI (`src/components/home/StoryComments.tsx`)

- Add a "Reply" button on each comment row.
- Track `replyingTo` state (the comment being replied to).
- When replying, show a small indicator above the input ("Replying to [name]" with a cancel button) and pass `parent_comment_id` to `addComment`.
- Nest the comment list: render top-level comments (where `parent_comment_id` is null), then indent replies beneath their parent with left padding (`pl-8`).

### 4. Community StoryCard (`src/components/community/StoryCard.tsx`)

- Apply the same threading logic to the comment section inside `StoryCard` (Reply button, nesting, reply-to indicator).

### Summary of files changed
- **1 migration** -- add `parent_comment_id` column
- `src/lib/community-api.ts` -- update interface + `addComment` signature
- `src/components/home/StoryComments.tsx` -- reply UI + nesting
- `src/components/community/StoryCard.tsx` -- reply UI + nesting

