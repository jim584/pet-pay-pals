

## Plan: Vetted™ — Affiliate E-Commerce Page

### 1. Database: Create `vetted_products` table

```sql
CREATE TABLE public.vetted_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listed_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price_text text,
  external_url text NOT NULL,
  store_name text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vetted_products ENABLE ROW LEVEL SECURITY;
```

RLS policies: public SELECT for all (anon + authenticated), authenticated INSERT/DELETE for own listings (`auth.uid() = listed_by`).

### 2. Create `src/lib/vetted-api.ts`

- `fetchVettedProducts(page, category?, search?)` — paginated query with optional category filter and ilike search on name/description/store_name, page size 12.
- `createVettedProduct(product)` — insert new listing.
- `deleteVettedProduct(id)` — delete own listing.

### 3. Create `src/components/vetted/ProductCard.tsx`

Card with product image (aspect-ratio), name, price text, store badge (e.g. "Amazon"), description snippet, and a "Shop Now" `<a>` button opening `external_url` in a new tab via `target="_blank" rel="noopener noreferrer"`.

### 4. Create `src/components/vetted/CreateProductDialog.tsx`

Form dialog: name, description, image URL, price text, external URL, store name, category select. Categories: Food, Toys, Health, Accessories, General.

### 5. Create `src/pages/VettedPage.tsx`

Shop-style layout following the same pattern as `HelpForeverPage`:
- Hero banner with Vetted™ branding.
- Search bar (debounced) + category filter tabs.
- Responsive product grid (2 cols mobile, 4 cols desktop).
- "List a Product" button for authenticated users.
- Infinite scroll with "Load More".

### 6. Update `src/App.tsx`

Replace `/vetted` placeholder route with `VettedPage`.

### 7. Seed sample products

Insert 6-8 sample products with Unsplash images and example external links (Amazon, Chewy, etc.).

