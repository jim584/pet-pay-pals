## Goal

On `/plans`, show pet owners which membership plan they are currently subscribed to, with a clear "Current plan" indicator and a way to manage the subscription.

## Current State

`fetchMyMembership(userId)` already exists in `src/lib/plans-api.ts` and returns the user's active/pending membership joined with its plan. It's used by `WalletView` but not by `PlansPage`. There's no visual cue on the Plans page.

## Changes

1. **`src/pages/PlansPage.tsx`**
   - Import `fetchMyMembership`, `openCustomerPortal`, and `Membership`/`MembershipPlan` types.
   - On mount (and when `user` changes), load the user's current membership into state.
   - When membership exists, render a "Current subscription" banner above the plan grid showing: tier label, species, billing interval, status badge, monthly/annual price, next renewal (`current_period_end`), and a "Manage subscription" button that opens the Stripe customer portal via `openCustomerPortal()` + `openCheckoutUrl()`.
   - Pre-select the species/billing interval to match the current membership when first loaded.
   - Pass `currentPlanId` and `currentBillingInterval` into each `<PlanCard />`.

2. **`src/components/plans/PlanCard.tsx`**
   - Accept new optional props: `isCurrent: boolean`, `isCurrentInterval: boolean`.
   - When `isCurrent && isCurrentInterval`, replace the Subscribe button with a disabled "Current plan" button and show a small "Active" badge in the header.
   - When `isCurrent` but interval differs, change button label to "Switch billing".
   - Add a subtle ring/border highlight to the active plan card.

3. **No DB or edge-function changes** — `fetchMyMembership` and `customer-portal` already exist.

### Extra (small UX win)

- If the user already has an active membership and clicks Subscribe on a different plan, the existing checkout flow handles it; no extra logic needed beyond the visual cue and portal link.