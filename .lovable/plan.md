

## Add "Home" navigation from the dashboard

Currently, once a user enters the dashboard (`/dashboard`), there is no link back to the public homepage (`/`). Users are stuck unless they manually edit the URL.

### Changes

1. **Desktop sidebar (`src/components/dashboard/DashboardSidebar.tsx`)**
   - Add a "Home" item (using the `Home` icon from lucide-react) at the top of both `ownerNav` and `vetNav` arrays, linking to `/`.

2. **Mobile bottom nav (`src/components/home/MobileBottomNav.tsx`)**
   - Already has a "Home" link pointing to `/` — no change needed.

3. **Dashboard header (`src/pages/DashboardLayout.tsx`)** *(optional)*
   - Make the "Help A Pet" logo/brand in the sidebar header clickable, linking to `/` as well, for an intuitive "click logo to go home" pattern.

This is a small, two-line change in the sidebar nav arrays.

