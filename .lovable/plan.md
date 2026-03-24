

## Plan: Build "Help a Pet Behave" Content Module

Transform the placeholder page at `/help-behave` into a full content management module with three tabs: Images Gallery, Video Library, and Training Blog. Follows the same architectural patterns as FearFreed (blog) and HelpProtect (database-driven feed).

### Database Changes

**1. New table: `behave_posts` (Training Blog)**
- id, author_id, title, content (text), featured_image_url, category, tags (text[]), excerpt, is_published, created_at, updated_at
- Categories: Behavior Issues, Training Tips, Beginner Guides, Aggression, Obedience, Puppy Training
- RLS: anyone can read published posts, authors can CRUD own posts

**2. New table: `behave_images` (Image Gallery)**
- id, uploaded_by, title, description, image_url, category, created_at
- RLS: anyone can view, uploaders can CRUD own images

**3. New table: `behave_videos` (Video Library)**
- id, uploaded_by, title, description, video_url (YouTube/Vimeo embed or storage URL), thumbnail_url, category, created_at
- RLS: anyone can view, uploaders can CRUD own videos

**4. New storage bucket: `behave-media` (public)**
- For image uploads and optional video uploads

### Frontend Changes

**5. Create `src/pages/HelpBehavePage.tsx`**
- Header with back button and Dog icon (matches compass menu)
- Hero banner describing the section
- Tab navigation: Images | Videos | Blog
- Search bar filtering across the active tab
- Each tab renders its respective content component

**6. Create `src/components/behave/ImageGallery.tsx`**
- Grid layout of image cards with title, description, category badge
- Upload dialog for authenticated users (multi-image upload via storage bucket)
- Edit/delete options for own images
- Category filter chips

**7. Create `src/components/behave/VideoLibrary.tsx`**
- Card layout with embedded video players (YouTube/Vimeo iframe or native video)
- Upload/embed dialog: paste a YouTube/Vimeo URL or upload a video file
- Title, description, category per video
- Responsive video embeds

**8. Create `src/components/behave/TrainingBlog.tsx`**
- Blog card list (reuses `BlogCard` pattern from FearFreed)
- "Create Post" dialog for authenticated users with title, featured image upload, rich text content (textarea), category select, tags input
- "Read More" expands to full post view (dialog or inline)
- Category/tag filter chips + search

**9. Create API layer: `src/lib/behave-api.ts`**
- CRUD functions for behave_posts, behave_images, behave_videos
- Paginated fetches with search/category filters

**10. Update `src/App.tsx`**
- Replace placeholder route with new `HelpBehavePage` component

### Technical Details

- Uses Tabs component for Images/Videos/Blog navigation
- Image uploads go to `behave-media` storage bucket
- Video section prioritizes YouTube/Vimeo URL embedding (extracts embed URL from paste); direct upload as fallback
- Blog uses textarea for content (not a full rich text editor) to keep scope manageable
- All three content types share the same category taxonomy for consistency
- Infinite scroll or "Load More" pagination pattern (matches HelpProtect)

