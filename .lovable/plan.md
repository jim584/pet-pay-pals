

## Plan: Fix Calendar Month Size Inconsistency

Different months show 4, 5, or 6 rows of weeks, causing the calendar to jump in size when navigating. The fix is to force `fixedWeeks` on the `DayPicker` so every month always renders 6 rows, keeping the calendar height constant.

### Change

**`src/components/ui/calendar.tsx`**
- Add `fixedWeeks` prop to `DayPicker` — this ensures all months display exactly 6 rows of days, filling in outside days as needed
- Since `showOutsideDays` is already `true` by default, the extra rows will show greyed-out days from adjacent months

This is a one-line change that fixes the issue globally across the entire app wherever `Calendar` is used.

