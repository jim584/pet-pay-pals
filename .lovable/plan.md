## Goal
Pet owners are the only ones who should create vet tickets. Vets should see a read-only queue of tickets assigned to their clinic. Today, the `/dashboard/vet-tickets` route renders the owner submission UI for everyone, so vets incorrectly see a "+ New ticket" button and dialog.

## Changes

### 1. `src/pages/VetTicketsPage.tsx` — split by role
- Read `role` from `useAuth()`.
- If `role === 'vet'`, render a new **IncomingTicketsView**:
  - Header: "Incoming Tickets" / "Tickets assigned to your clinic by pet owners."
  - No "New ticket" button, no submission dialog, no "Pay remainder" button.
  - Loads tickets via `listTicketsForVet(vetProfileId)` (already exists in `src/lib/vet-tickets-api.ts`).
  - Resolves vet profile id via `fetchVetProfile(user.id)`.
  - Lists tickets with: pet name, owner name, clinic, estimate amount, status badge, created date, and "Open estimate / attestation" links using `getTicketFileSignedUrl`.
- Otherwise (owner / admin viewing as owner), keep the existing owner UI as-is.

### 2. `src/components/dashboard/DashboardSidebar.tsx`
- In `vetNav`, rename the "Vet Tickets" item label to **"Incoming Tickets"** (same `/dashboard/vet-tickets` URL).

### 3. `supabase/functions/submit-vet-ticket/index.ts` — defense in depth
- After auth, check the caller's role from `user_roles`. If they have `vet` or `admin` role and **no** `pet_owner` role, return `403 { error: "Only pet owners can submit vet tickets" }`.
- Keeps the existing owner_id / pet ownership checks intact.

### 4. No DB migration needed
Existing RLS already restricts inserts to `owner_id = auth.uid()`; this change is purely UX + a server-side role guard.

## Out of scope
- No changes to the approval / funding / Stripe Issuing flow.
- No change to `VetDashboardHome.tsx` (it already has its own correct read-only tickets section).
