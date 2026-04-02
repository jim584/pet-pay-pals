

## Plan: Increase Logo Size in Top Left

The logo in the HomePage header (`src/pages/HomePage.tsx`) and dashboard sidebar (`src/components/dashboard/DashboardSidebar.tsx`) are both `h-10` (40px). I'll increase them for better visibility.

### Changes

**1. `src/pages/HomePage.tsx` (line 53)**
- Change logo from `h-10` to `h-14` (56px)
- Also increase header height from `h-14` to `h-16` to accommodate

**2. `src/components/dashboard/DashboardSidebar.tsx` (line 63)**
- Change logo from `h-10` to `h-14` (56px)

