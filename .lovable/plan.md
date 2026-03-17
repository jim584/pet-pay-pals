

## Plan: Add Sample Pet Photos to Adoption Listings

Update the 8 existing adoption listings in the database with publicly available pet image URLs from Unsplash. Each listing will get a relevant photo URL added to its `photo_urls` array based on its species/breed.

### Single Step
Run a data UPDATE query (via the insert tool) to set `photo_urls` for each adoption listing using free Unsplash image URLs — dog photos for dog listings, cat photos for cat listings, and a rabbit photo for the rabbit listing.

No code changes needed — the `AdoptionCard` component already renders photos from `photo_urls[0]`.

