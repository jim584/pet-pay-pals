

## Plan: Build "Help A Pet Forever" Adoption Feed

### Overview
Replace the placeholder at `/help-forever` with a full adoption feed page. This requires a new database table for adoption listings, a new page component, and supporting API/UI code.

### 1. Database: Create `adoption_listings` table

New table with columns:
- `id` (uuid, PK)
- `pet_name` (text, required)
- `species` (text — dog, cat, other)
- `breed` (text, nullable)
- `age_text` (text — e.g. "2 years", "6 months")
- `gender` (text — male/female)
- `description` (text)
- `photo_urls` (text array)
- `shelter_name` (text, required)
- `shelter_location` (text, nullable)
- `contact_phone` (text, nullable)
- `contact_email` (text, nullable)
- `contact_website` (text, nullable)
- `is_adopted` (boolean, default false)
- `posted_by` (uuid, references auth.users via profiles pattern)
- `created_at`, `updated_at` (timestamps)

RLS policies:
- SELECT: public (anon + authenticated) can view all non-adopted listings
- INSERT: authenticated users can insert own listings
- UPDATE/DELETE: only the poster or admins

### 2. New API file: `src/lib/adoption-api.ts`
- `fetchAdoptionListings(page, filters)` — paginated query with optional species filter
- `createAdoptionListing(data)` — insert new listing
- Types for `AdoptionListing`

### 3. New page: `src/pages/HelpForeverPage.tsx`
- Same layout structure as HomePage (header, optional sidebar)
- Species filter tabs at top (All / Dogs / Cats / Others)
- Card-based feed showing each listing with:
  - Pet photo (large)
  - Name, breed, age, gender badges
  - Description text
  - Shelter info section (name, location, phone, email, website)
  - "Contact Shelter" button
- Infinite scroll / Load More pagination
- CTA banner for logged-in users to post adoption listings

### 4. New component: `src/components/adoption/AdoptionCard.tsx`
- Displays one adoption listing with all details
- Responsive card layout matching existing feed card style

### 5. New component: `src/components/adoption/CreateAdoptionDialog.tsx`
- Form dialog for posting a new adoption listing
- Fields: pet name, species, breed, age, gender, description, photos, shelter info, contact details

### 6. Route update in `App.tsx`
- Replace `/help-forever` placeholder route with the new `HelpForeverPage`

### 7. Storage
- Reuse the existing `pet-photos` bucket for adoption listing images

