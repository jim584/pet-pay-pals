

## Plan: FearFreed™ Blog Page with Dummy Posts

Create a blog-style page at `/fearfreed` with hardcoded placeholder blog posts to preview the content layout.

### 1. Create `src/pages/FearFreedPage.tsx`

A blog landing page following the same header/layout pattern as `HelpProtectPage`:
- Header with back button and FearFreed™ branding (ShieldOff icon).
- Hero banner explaining the section: "Overcome fear, anxiety & phobias — expert-backed guides for pets and owners."
- Search bar (client-side filtering on dummy data).
- Blog post grid: 2 columns on desktop, 1 on mobile.
- Each blog card: cover image (Unsplash), title, summary excerpt, category tag, read time, and author avatar placeholder.

### 2. Hardcoded dummy blog posts (6-8 entries)

Example posts:
- "How to Help Your Dog Overcome Thunderstorm Anxiety"
- "Separation Anxiety in Cats: Signs & Solutions"
- "Fireworks Season: A Survival Guide for Pet Owners"
- "Desensitization Training: A Step-by-Step Approach"
- "Understanding Fear Aggression in Rescue Dogs"
- "Calming Products That Actually Work for Anxious Pets"

Each with a summary paragraph, Unsplash cover image, category tag (Anxiety, Phobias, Training, Wellness), and estimated read time.

### 3. Blog card component — `src/components/fearfreed/BlogCard.tsx`

Card with: cover image (aspect-ratio 16:9), category badge, title, summary snippet (2-3 lines clamped), read time, and a "Read More" button (currently non-functional / shows a toast that full articles are coming soon).

### 4. Update `src/App.tsx`

Replace the `/fearfreed` placeholder route with the new `FearFreedPage`.

No database changes needed — all content is hardcoded placeholders for now.

