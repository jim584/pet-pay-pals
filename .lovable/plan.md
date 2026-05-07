## Problem

`/admin/reserve` shows "Failed to load reserve data — Could not find a relationship between member_reserve_consumptions and vet_tickets in the schema cache". The DB has no foreign keys defined (per the schema), so PostgREST cannot embed `vet_tickets` from `member_reserve_consumptions`.

The offending query is in `src/lib/admin-api.ts → fetchAdminReserveConsumptions`:

```ts
.from("member_reserve_consumptions")
.select("*, ticket:vet_tickets(owner_id)")
```

The sister helper `fetchMyReserveHistory` (`src/lib/reserve-history-api.ts`) already does it correctly with two separate queries.

## Fix

Update `fetchAdminReserveConsumptions` in `src/lib/admin-api.ts` to drop the embed and resolve `ticket → owner → profile` with two follow-up queries:

1. Select `*` from `member_reserve_consumptions` (no embed).
2. Collect `ticket_id`s and fetch matching `vet_tickets(id, owner_id)`.
3. Collect `owner_id`s and fetch matching `profiles(user_id, full_name)`.
4. Map each row's `user_full_name` from the resolved owner profile.

No DB or RLS changes required.