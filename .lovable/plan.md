## Bug
On `/admin/vets/:id`, loading details fails with: *"Could not find a relationship between 'appointments' and 'owner_id' in the schema cache."*

## Cause
`fetchAdminVetAppointments` in `src/lib/admin-api.ts` (line ~467) embeds the owner via PostgREST relationship syntax:

```
.select("*, pets(name, species), profiles:owner_id(full_name), services(name, price)")
```

There is no foreign key from `appointments.owner_id` to `profiles`, so PostgREST cannot resolve the join. `pets` and `services` also lack declared FKs but happen to work via the table name; the explicit `profiles:owner_id(...)` hint forces FK resolution and fails.

## Fix
**`src/lib/admin-api.ts` — `fetchAdminVetAppointments` only:**

1. Remove `profiles:owner_id(full_name)` from the select.
2. After the appointments query, collect distinct `owner_id`s and run a second query: `supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds)`.
3. Build a `Map<user_id, full_name>` and use it to populate `owner_full_name` in the returned rows.

No DB migration, no other files touched. The `pets`/`services` embeds remain unchanged since they currently work; if they later break, apply the same two-query pattern.