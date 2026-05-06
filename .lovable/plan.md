## Fix: Admin Vets page "could not find a relationship"

**Cause:** `src/lib/admin-api.ts` queries `vet_profiles` with PostgREST embed `profiles:user_id(full_name, avatar_url)`. There's no foreign key from `vet_profiles.user_id` to `profiles`, so PostgREST returns PGRST200.

**Fix:** Replace the embed with a separate `profiles` lookup, then merge in JS. No DB schema change.

### Changes — `src/lib/admin-api.ts`

1. **`fetchAdminVets`** (line ~341): Select `vet_profiles` columns only. Collect `user_id`s, fetch matching `profiles` via `.in("user_id", ids)`, build a map, and populate `owner_full_name` / `owner_avatar_url` from it.

2. **`fetchAdminVetDetail`** (line ~381): Same pattern — fetch the vet row, then a single `profiles` query by that `user_id` and merge.

No other files, no migrations, no RLS changes needed.