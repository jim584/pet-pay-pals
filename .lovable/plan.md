## Admin Vet Management

Replace the placeholder `/admin/vets` route with a full vet management module covering approvals, services, and consultations (appointments).

### Pages & Routes

- `/admin/vets` — Vets list (default tab: Pending approvals)
- `/admin/vets/:vetProfileId` — Vet detail page with sub-tabs: Profile · Services · Consultations · Tickets

### Vets List Page (`AdminVetsPage.tsx`)

Tabs: **Pending** (`is_approved=false`) · **Approved** · **All**.

Each row shows: clinic name, owner name/avatar, location, phone, specializations, signup date, status badge.

Row actions:
- **Approve** / **Revoke approval** (toggles `vet_profiles.is_approved`)
- **View details** → opens detail page
- Search by clinic name / owner name

### Vet Detail Page (`AdminVetDetailPage.tsx`)

Header: clinic name, owner, contact info, approval toggle, "Open public profile" link.

Tabs:
- **Profile** — read-only summary + admin can edit `is_approved`, location, phone, website, specializations, bio (admin-only update policy already exists).
- **Services** — table of `services` for this vet (name, price, duration, active). Read-only view with toggle to deactivate (admin can update via new admin RLS policy on services).
- **Consultations** — list of `appointments` for this vet with pet, owner, service, scheduled time, status. Filter by status (pending/confirmed/completed/cancelled). Admin can update appointment status or cancel.
- **Vet Tickets** — quick link to `/admin/vet-tickets?vetProfileId=...`.

### API Layer (`src/lib/admin-api.ts` additions)

- `fetchAdminVets(filter: 'pending' | 'approved' | 'all', search?)` — joins `profiles` for owner name.
- `fetchAdminVetDetail(vetProfileId)` — vet profile + owner profile.
- `setVetApproval(vetProfileId, approved)` — direct UPDATE (admin RLS already allows).
- `fetchAdminVetServices(vetProfileId)` — list services.
- `setVetServiceActive(serviceId, active)` — admin update.
- `fetchAdminVetAppointments(vetProfileId, statusFilter?)` — joins pet, owner profile, service.
- `updateAdminAppointment(id, { status, notes? })`.

### Database Migration

Current RLS gaps: admin cannot update/delete `services` or update/delete `appointments`. Add:

```sql
-- Admins can fully manage services
create policy "Admins can manage services"
  on public.services for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Admins can update/delete appointments
create policy "Admins can update any appointment"
  on public.appointments for update to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create policy "Admins can delete appointments"
  on public.appointments for delete to authenticated
  using (has_role(auth.uid(), 'admin'));
```

(`vet_profiles` already has admin update + admin select via "Anyone authenticated can view".)

### Wiring

- Update `src/App.tsx`: replace the placeholder route with `<Route path="vets" element={<AdminVetsPage />} />` and add `<Route path="vets/:vetProfileId" element={<AdminVetDetailPage />} />`.
- `AdminSidebar` already has the Vets entry — no change needed.
- Optional: add a "Pending vets" KPI card to `AdminOverviewPage` (count of `is_approved=false`).

### UX Details

- Confirm dialogs (AlertDialog) before approval revoke, service deactivation, appointment cancellation.
- Toast feedback on all mutations and React Query invalidation per affected list.
- Status badges reuse existing color tokens (no new colors).
- Empty states for each tab.

### Out of Scope

- No edits to vet payout flows (already in `/admin/vet-tickets`).
- No new vet messaging features.
- No changes to vet self-service pages.