## Add "Set up autopay" CTA to empty BNPL state

### Change
In `src/pages/PaymentPlansPage.tsx`, add a primary action button to the "No payment plans yet" empty state that takes the user into the existing autopay setup flow (the `AutopaySetupCard` already rendered at the top of the page).

### Implementation
1. Wrap the `AutopaySetupCard` at line 145 in a `div` with `id="autopay-setup"` and a `ref`.
2. In the empty state (lines 168–182), add a `Button` below the description:
   - Label: "Set up autopay"
   - Icon: `CreditCard`
   - On click: scroll the autopay section into view smoothly, then programmatically click the "Set up autopay" / "Replace card" button inside `AutopaySetupCard` (queried via the ref) so the user goes straight into the Stripe checkout handoff without an extra step.
3. If a payment method is already saved (button reads "Replace card"), the empty-state button still works the same — it just reopens the setup flow.

### Notes
- No changes needed to `AutopaySetupCard.tsx`; the existing `start()` handler already opens Stripe in `_top` and shows the fallback "Continue" link.
- No new routes, API calls, or schema changes.
