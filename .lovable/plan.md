

## Plan: Set Logo to 80×112px

### Changes

**1. `src/pages/HomePage.tsx` (line 53)**
- Change logo class from `h-14 w-auto` to inline style `width: 80px; height: 112px` (since Tailwind doesn't have exact 80/112px utilities)
- Increase header height from `h-16` to accommodate (use `h-32` or inline style)

**2. `src/components/dashboard/DashboardSidebar.tsx` (line 63)**
- Change logo class from `h-14 w-auto` to inline style `width: 80px; height: 112px`

Both logos will use `style={{ width: 80, height: 112 }}` with `object-contain` to maintain aspect ratio.

