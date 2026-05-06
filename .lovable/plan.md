# Show Vet Tickets in the Vet Dashboard

Currently, when a pet owner submits a vet ticket they can pick a `vet_profile_id`, but the assigned vet has no way to see it. This plan adds a "Vet Tickets" section visible to vets in their dashboard.

## What will change

### 1. Database (migration)
Add an RLS policy on `vet_tickets` so a vet can SELECT tickets where `vet_profile_id` belongs to them:

```sql
CREATE POLICY "Vets can view tickets assigned to them"
ON public.vet_tickets FOR SELECT
TO authenticated
USING (
  vet_profile_id IS NOT NULL
  AND public.is_vet_profile_owner(vet_profile_id, auth.uid())
);
```

(No changes to owner/admin policies; uses the existing `is_vet_profile_owner` security-definer function so there is no recursion risk.)

### 2. API (`src/lib/vet-tickets-api.ts`)
Add:
```ts
listTicketsForVet(vetProfileId: string): Promise<VetTicket[]>
```
Selects from `vet_tickets` filtered by `vet_profile_id`, ordered by `created_at desc`.

### 3. UI — Vet Dashboard (`src/components/vet/VetDashboardHome.tsx`)
- After loading `vetProfile`, also fetch assigned tickets.
- Add a new card/section "Funding Tickets" listing each ticket with:
  - Pet name (looked up via `pets` table by id), owner name (via `profiles`)
  - Clinic name, estimate amount, approved amount
  - Status badge (submitted / approved / funded / card_issued / settled / rejected …)
  - Submitted date
  - Buttons to open the estimate / attestation file (signed URLs from the existing `vet-tickets` storage bucket via `getTicketFileSignedUrl`)
- Read-only for now — vets cannot approve/reject (that stays admin-only).

No changes needed to the submit flow or admin queue.

## Out of scope
- Vet actions on tickets (approve, mark services rendered) — can be added later if you want.
- A dedicated `/vet/tickets` page — section lives inside the existing dashboard for now.
