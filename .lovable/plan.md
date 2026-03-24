

## Plan: Admin Control for "Help a Pet Behave" Content

Currently, users can only create/delete their own content. This plan adds full admin control so admins can add, edit, and delete **any** content across all three tabs (images, videos, blog posts).

### Current Gaps
- No edit functionality exists for any content type
- Delete is restricted to content owners only (no admin override)
- Create buttons only show for logged-in users, not admin-aware
- No `update` API functions exist in `behave-api.ts`

### Changes

**1. Database: Add admin RLS policies for all 3 behave tables**
- Add admin SELECT/UPDATE/DELETE policies on `behave_posts`, `behave_images`, `behave_videos` so admins can manage any content (using the existing `has_role(auth.uid(), 'admin')` function)

**2. API layer (`src/lib/behave-api.ts`)**
- Add `updateBehavePost`, `updateBehaveImage`, `updateBehaveVideo` functions
- Add `fetchAllBehavePosts` variant that includes unpublished posts (for admin view)

**3. Update `ImageGallery.tsx`**
- Add edit dialog (pre-fills title, description, category) triggered by an Edit button
- Show Edit and Delete buttons for admins on all images (not just own)
- Pass `role` from AuthContext to check admin status

**4. Update `VideoLibrary.tsx`**
- Add edit dialog for title, description, video URL, category
- Show Edit and Delete buttons for admins on all videos

**5. Update `TrainingBlog.tsx`**
- Add edit dialog for title, content, excerpt, category, tags, featured image
- Show Edit and Delete buttons for admins on all posts
- Admin can toggle `is_published` status

**6. Update `HelpBehavePage.tsx`**
- Show admin badge/indicator when admin is viewing
- No structural changes needed; admin controls live inside each tab component

### Technical Details
- Admin check: `role === "admin"` from `useAuth()` — already available in AuthContext
- Edit dialogs reuse the same form structure as create dialogs, pre-filled with existing data
- The `isAdmin` flag is computed once per component: `const isAdmin = role === "admin"`
- Delete actions for admin users will show a confirmation dialog (follows existing deletion safety pattern)
- All three components get an identical pattern: `{(isAdmin || user?.id === item.owner_id) && <EditDeleteButtons />}`

