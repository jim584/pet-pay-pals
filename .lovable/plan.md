## Goal

Replace the "coming soon" placeholder at `/admin/reserve` with a real Wallet & Reserve admin module that summarizes Direct Pay accruals, the Community Reserve, and DP expiry history.

## What it shows

Top KPI cards:
- **Community Reserve balance** (from `community_reserve.balance`, single row).
- **Active DP outstanding** — sum of `direct_pay_accruals.remaining_amount` where `expired = false`.
- **Expiring within 60 days** — sum of `remaining_amount` for unexpired accruals with `expires_at` within next 60 days.
- **DP expired (lifetime)** — sum of `dp_expiry_ledger.expired_amount`, with breakdown into Reserve / Help-Now / Admin portions shown as a small legend.

Action row:
- **"Run DP expiry job"** button → invokes `process-dp-expiry` edge function, then refreshes data (with toast for processed count + reserve added).
- **Refresh** button.

Two tables (each in a `Card`, with skeleton loading states matching `AdminPaymentsPage.tsx`):

1. **Direct Pay Accruals** (latest 100, default filter "active")
   - Filter: All / Active / Expired (Select)
   - Columns: User, Amount, Remaining, Accrual month, Expires at (with "Expires in Nd" badge if <60d, "Expired" muted badge if past), Status.
   - Joined `profiles.full_name` like other admin tables.

2. **DP Expiry Ledger** (latest 100)
   - Columns: Date, Accrual ref (short id), Expired amount, → Reserve, → Help-Now, → Admin, Reason.
   - Empty state message when ledger has no rows (current state).

## Technical

**`src/lib/admin-api.ts`** — add:
- `fetchReserveKpis()` → `{ reserveBalance, activeOutstanding, expiringSoon, lifetimeExpired, lifetimeReserveIn, lifetimeHelpNow, lifetimeAdmin }`. Uses 4 parallel queries:
  - `community_reserve` select balance limit 1
  - `direct_pay_accruals` select remaining_amount, expires_at where `expired=false`
  - `dp_expiry_ledger` select all portion columns
- `fetchAdminAccruals(filter: "all"|"active"|"expired")` → joined with profiles (two-step like `fetchAdminMemberships`), limit 100, ordered by `created_at desc`.
- `fetchAdminDpExpiryLedger()` → limit 100, ordered by `created_at desc`.
- `runDpExpiryJob()` → `supabase.functions.invoke("process-dp-expiry")`.

**`src/pages/admin/AdminReservePage.tsx`** (new) — uses Card/Table/Badge/Skeleton/Select primitives matching AdminPaymentsPage style; reuses the `fmt(n)` currency helper inline.

**`src/App.tsx`** — replace `<Route path="reserve" element={<AdminPlaceholder title="Wallet & Reserve" />} />` with `<Route path="reserve" element={<AdminReservePage />} />` and add the import.

No DB schema changes, no RLS changes (admin policies already cover all three tables). The `process-dp-expiry` edge function exists and is unchanged.

## Out of scope

- Manual reserve adjustments / withdrawals (no UI for spending the reserve in this phase).
- Per-user wallet drill-down (already covered by user pages).
