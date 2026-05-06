# Admin Dashboard

## Current state

You have **one** admin-only page today: `/admin/vet-tickets` (review/approve/reject vet ticket claims). There is no unified admin shell, no user management, no content moderation, and no membership/payment oversight UI. Admins must use the database directly for everything else.

## What to build

A dedicated `/admin` area with its own sidebar layout (separate from the user dashboard), gated by the `admin` role, containing the following modules:

### 1. Admin shell
- `/admin` route group with `AdminLayout` (sidebar + header), guarded so only `user_roles.role = 'admin'` can enter; everyone else redirected.
- Sidebar links to all modules below; reuses brand styling (Navy/Gold, Space Grotesk).

### 2. Overview (`/admin`)
- KPI cards: total users, pet owners, vets, active memberships, MRR (from `payment_history`), pending vet tickets, open protection cases, new signups (7d/30d).
- Recent activity feed: latest signups, latest tickets, latest payments.

### 3. Users & Roles (`/admin/users`)
- Searchable/filterable list of users (from `profiles` joined with `user_roles`).
- Actions: view profile, assign/remove roles (pet_owner, vet, admin), suspend (soft flag), view their pets/memberships.

### 4. Vets (`/admin/vets`)
- List vet clinics, verification status, services, payout history.
- Approve/verify vet profiles; view their tickets and payouts.

### 5. Vet Tickets (`/admin/vet-tickets`)
- Keep existing page; move it under the new admin shell.

### 6. Memberships & Plans (`/admin/memberships`)
- List all memberships with tier, status, period end, accrued DP.
- Manage `membership_plans` (edit pricing, caps, DP windows).
- Manual actions: cancel, extend, refund hooks.

### 7. Payments (`/admin/payments`)
- Full `payment_history` view with filters (status, date, kind).
- Link to Stripe hosted invoice; export CSV.

### 8. Content Moderation (`/admin/content`)
- Tabs for: Stories, Adoption posts, Protection cases, Vetted shop products, FearFreed/Behave posts.
- Actions: hide/unhide, delete, pin (for protection priority), feature.

### 9. Pets (`/admin/pets`)
- Search all pets across the platform; view owner; soft-delete spam.

### 10. Settings (`/admin/settings`)
- Platform toggles: feature flags (e.g., show/hide social sharing), default plan caps, membership financial rules display.

## Technical details

- **Routes**: add `<Route path="/admin" element={<AdminLayout />}>` with nested children in `src/App.tsx`. Move existing `/admin/vet-tickets` under it.
- **Layout**: new `src/pages/admin/AdminLayout.tsx` mirroring `DashboardLayout` but with `AdminSidebar` listing all modules. Guard inline: redirect non-admins to `/`.
- **Data access**: most admin reads need to bypass standard RLS (which scopes to `auth.uid()`). Add admin-scoped RLS policies using the existing `has_role(auth.uid(), 'admin')` function on tables that don't already permit admin select (profiles, memberships, payment_history, pets, stories, products, etc.). Destructive admin actions (role assignment, refunds, plan edits) go through new edge functions that verify admin via `has_role` server-side, mirroring `approve-vet-ticket`.
- **API layer**: new `src/lib/admin-api.ts` with typed functions per module (listUsers, assignRole, listMemberships, listPayments, moderateStory, etc.).
- **New edge functions**: `admin-assign-role`, `admin-update-membership`, `admin-moderate-content`, `admin-refund-payment` (calls Stripe). All use service-role client + admin check pattern from `approve-vet-ticket/index.ts`.
- **Sidebar entry**: add an "Admin" link in `DashboardSidebar` that only appears when `role === 'admin'`, linking to `/admin`.

## Out of scope (can add later)

- Audit log table for admin actions
- Bulk operations / CSV import
- Email broadcast tools
- Analytics charts beyond basic KPIs

## Suggested phasing

If this feels large, I recommend Phase 1 = Shell + Overview + Users/Roles + Vet Tickets move; Phase 2 = Memberships + Payments; Phase 3 = Content Moderation + Pets + Settings.

Want me to do all of it, or start with Phase 1?
