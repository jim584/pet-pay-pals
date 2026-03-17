

## Plan: Add Instagram-Style Image Cropper to Photo Uploads

Add a reusable image cropping dialog that appears whenever a user selects a photo — across story posts, pet profiles, and any future upload points. Users can pan, zoom, and crop before the image is finalized, just like Instagram.

### Library

Install `react-easy-crop` — a lightweight, well-maintained React cropper with pinch-zoom, drag, and aspect ratio support.

### New Component: `src/components/ui/ImageCropDialog.tsx`

A reusable modal that:
- Takes an image source (data URL) and an aspect ratio (default 4:3 per existing feed convention)
- Shows a crop area with drag/zoom controls (slider for zoom)
- On confirm, uses `canvas` to produce a cropped `Blob`/`File`
- On cancel, discards the crop
- Returns the cropped file and preview URL to the parent

### Changes to `CreateStoryDialog.tsx` (story posts)

- When user selects photo(s), instead of immediately adding to the photos array, open the `ImageCropDialog` for each image sequentially
- After cropping, add the cropped file + preview to state
- Supports the existing multi-photo flow (up to 4 images)

### Changes to `PetFormDialog.tsx` (pet profile photo)

- After file selection, open `ImageCropDialog` with a 1:1 (square) aspect ratio for profile photos
- On confirm, set the cropped file as the selected photo

### Helper: `src/lib/crop-utils.ts`

A utility function `getCroppedImage(imageSrc, cropArea)` that draws onto an offscreen canvas and returns a `Blob` — keeps the crop logic reusable and out of components.

### Summary of files

| File | Action |
|------|--------|
| `package.json` | Add `react-easy-crop` |
| `src/lib/crop-utils.ts` | Create — canvas crop helper |
| `src/components/ui/ImageCropDialog.tsx` | Create — reusable crop modal |
| `src/components/community/CreateStoryDialog.tsx` | Edit — integrate cropper into multi-photo flow |
| `src/components/pets/PetFormDialog.tsx` | Edit — integrate cropper for pet profile photo |

No database or backend changes needed.

