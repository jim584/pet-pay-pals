

## Fix: Broken Image for Salmon Oil Supplement

The Salmon Oil Supplement product has image URL `https://images.unsplash.com/photo-1583337130417-13104dec14c3` which is an invalid/broken Unsplash image.

### Fix
Run a database migration to update this product's `image_url` to a valid Unsplash image of a pet supplement/salmon oil bottle:

```sql
UPDATE public.vetted_products
SET image_url = 'https://images.unsplash.com/photo-1585553616435-2dc0a54e271d?w=400&h=400&fit=crop'
WHERE name = 'Salmon Oil Supplement for Pets';
```

No code changes needed — just a data fix.

