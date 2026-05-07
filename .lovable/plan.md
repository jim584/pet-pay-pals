Remove the "Appointments, payments, and membership features coming in Phase 3 & 4. 🚀" notice from the dashboard.

### Change
- `src/pages/DashboardHome.tsx` (lines 46–50): delete the entire `<Card>` containing that paragraph.

That's the only occurrence of the phrase in the codebase (verified via search). The unrelated admin placeholder ("This admin module is part of an upcoming phase. Coming soon.") in `AdminPlaceholder.tsx` is left untouched since it's a different message about admin modules, not the dashboard phase notice.