# Admin Membership Approval & Status Management

## Current state

Memberships today auto-activate via Stripe webhook the moment a user pays — there's no manual gate. Admins also can't currently:
- Approve or decline pending applications (none exist as a concept)
- Pause, cancel, or reactivate someone's membership
- See a clear audit trail of status changes

The `memberships` table already supports statuses (`pending`, `active`, `past_due`, `cancelled`, `paused`) and admin SELECT via RLS.

## What to build

### A. Admin Memberships page (`/admin/memberships`)

Replace the placeholder with a full management screen:

- **Filter tabs**: All · Pending review · Active · Past due · Cancelled
- **Search**: by user name or plan
- **Table/cards** showing: user, plan tier (Bronze/Silver/Gold/Platinum + species), billing interval, status badge, started date, period end, last payment, accrued DP balance
- **Per-row actions** (status-aware):
  - `pending` → **Approve** (sets `active`, sets `started_at`) · **Decline** (sets `cancelled` with reason)
  - `active` → **Pause** · **Cancel** · **Extend period end** (date picker)
  - `past_due` → **Mark active** · **Cancel**
  - `paused` → **Reactivate** · **Cancel**
  - `cancelled` → **Reactivate** (re-opens, keeps history)
  - All states → **View history** (modal of status changes + payments)

### B. Status change history

New `membership_status_changes` table to record every admin action and webhook-driven status flip. Each row: membership_id, from_status, to_status, reason, changed_by (nullable for webhook), source (`admin` | `webhook` | `system`), notes, created_at.

A trigger on `memberships` UPDATE auto-logs status flips so we capture both webhook and admin changes uniformly.

### C. Manual admin-created membership applications

So "approve/decline" has something to approve, add a second entry path:
- New "Request membership (admin review)" button on `/plans` that creates a membership row directly with `status='pending'` and **no Stripe checkout yet**.
- After admin approves a pending row, the user receives a "Complete payment" CTA in their wallet that triggers the existing checkout flow. On successful payment, the webhook flips it to `active`.
- Decline: sets status `cancelled` and stores `admin_notes` / `rejection_reason`.

This preserves the existing self-serve Stripe path (still auto-activates) **and** adds an admin-gated path for cases that need review.

### D. Admin sidebar entry on Wallet

For a member whose `pending` request was approved, surface a "Pay to activate membership" card on `/dashboard/wallet`.

## Technical details

### Migration
- `ALTER TABLE memberships ADD COLUMN admin_notes text, rejection_reason text, requires_admin_approval boolean DEFAULT false`.
- New table `public.membership_status_changes` with admin/owner SELECT RLS, no direct INSERT/UPDATE/DELETE from clients.
- Trigger `on_membership_status_change` — `AFTER UPDATE OF status` — inserts into the history table when `OLD.status IS DISTINCT FROM NEW.status`. Source is read from a session GUC `app.status_source` (defaults to `system`); admin edge function sets it via `SET LOCAL`.

### Edge function `admin-update-membership`
Mirrors the `admin-assign-role` pattern (auth + admin role check via `has_role`). Accepts:
```
{ membership_id, action: 'approve' | 'decline' | 'pause' | 'cancel' | 'reactivate' | 'mark_active' | 'extend',
  reason?: string, admin_notes?: string, new_period_end?: ISO date }
```
- For `cancel` on an active subscription, also cancels in Stripe (`stripe.subscriptions.cancel`) so billing stops.
- For `pause`, calls `stripe.subscriptions.update(..., { pause_collection: { behavior: 'mark_uncollectible' } })`.
- For `reactivate` from paused, removes pause; from cancelled (no live sub), only flips DB status — user must re-pay to resume billing.
- All DB writes wrapped in a single statement that calls `set_config('app.status_source','admin', true)` so the trigger logs `source='admin'`.

### API layer
`src/lib/admin-api.ts` adds:
- `fetchAdminMemberships(filter, search)` — joins plans + profiles
- `fetchMembershipHistory(membershipId)`
- `adminMembershipAction(...)` (invokes edge function)

### Pages / components
- `src/pages/admin/AdminMembershipsPage.tsx` — list, tabs, search
- `src/components/admin/MembershipRow.tsx` — single row with action menu and confirm dialogs
- `src/components/admin/MembershipHistoryDialog.tsx` — timeline of status changes + payments

### Webhook updates
Webhook continues to write status changes. The trigger logs them as `source='system'` automatically (no GUC set). No webhook code changes needed except setting the `requires_admin_approval` flag to false on auto-activated memberships.

### Self-serve UI tweak
In `WalletView`, if `membership.status === 'pending' && requires_admin_approval`, show "Awaiting admin approval"; if `pending && !requires_admin_approval`, show "Complete payment" with checkout button (after admin approves an admin-review application).

## Out of scope (future)

- Refunds from the admin UI (stays on Payments module)
- Bulk approve/decline
- Email notifications to user on status change

Ready to build?
