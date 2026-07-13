
## Goal
Every newly submitted Vet Ticket becomes **Approved** immediately, with no admin action required. Other ticket types (BNPL, reconsiderations, etc.) are unchanged.

## Changes

### 1. `supabase/functions/submit-vet-ticket/index.ts` — force auto-approval
- Remove the blockers checklist (attestation / vet standing / excluded procedure / threshold / membership / risk flags).
- Still compute coverage via `compute-ticket-coverage` (best effort) so DP/BNPL/Reserve funding paths keep working when available.
- Always call `approve-vet-ticket` with the computed breakdown. If coverage computation fails or returns nothing usable, fall back to a breakdown of `{ dp_use:0, bnpl_use:0, reserve_use:0, member_remainder: estimate_amount }` so the ticket still ends in status `approved`.
- Response returns `auto_approved: true` and no blockers.

### 2. `supabase/functions/approve-vet-ticket/index.ts` — allow bare approval
- Keep existing logic, but when the internal auto-approve caller sends the fallback breakdown, do not require reserve/BNPL setup (already handled by zero values). No structural changes beyond ensuring status ends as `approved` (or `funded` if fully covered by DP/Reserve, matching current behavior). No behavior change for admin-initiated calls.

### 3. `src/pages/AdminVetTicketsPage.tsx` — remove manual approval UI
- Remove the **Approve** button, the **Bulk Approve** control, and the coverage-preview dialog used for approving.
- Keep read-only visibility of every ticket (status, amount, breakdown, messages).
- Keep the **Reject** action available for admin fraud control (user said remove *approval* requirement; rejection is a separate safeguard). If the user wants Reject removed too, we'll drop it in a follow-up.
- Replace the "Pending review" tab label with "Recently submitted" since nothing waits on admin action.

### 4. No DB migration required
Ticket statuses already include `approved` / `funded`. Nothing schema-level changes.

## User-facing result
- Owner submits a Vet Ticket → instantly sees status **Approved** (or **Funded** if fully covered).
- Admin dashboard shows every ticket but no Approve button and no pending-approval queue.
- Other ticket flows (BNPL obligations, reconsideration requests) are untouched.
