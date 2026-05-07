## Problem

`/plans` (Together™ Membership Plans) renders as a standalone full-page view with no header, no app navigation, and no back button. Once a user lands there they have no in-app way to return to the dashboard or homepage — they have to use the browser back button.

## Fix

Add a clear back-navigation affordance at the top of `src/pages/PlansPage.tsx`.

### Changes (single file: `src/pages/PlansPage.tsx`)

1. Import `ArrowLeft` from `lucide-react` and `Button` from `@/components/ui/button`.
2. Add a small "Back" row above the page title:
   - A ghost `Button` with `<ArrowLeft />` + label that calls `navigate(-1)` if there is history, otherwise falls back to `navigate("/")`.
   - Use semantic tokens (no hardcoded colors) consistent with the rest of the page.
3. Keep everything else (species tabs, billing toggle, plan grid, checkout flow) unchanged.

### Why this approach

- Minimal, scoped change — does not touch the router or layout system.
- `navigate(-1)` matches user expectation ("go back to where I came from"), with a homepage fallback for users who deep-link directly to `/plans`.
- Per project memory, "Help A Pet Now" / home is always `/`, so the fallback is correct.

### Out of scope

- Wrapping `/plans` in the global 3-column dashboard layout (larger refactor; can be a follow-up if desired).
- Changes to the post-checkout return URL from Stripe.