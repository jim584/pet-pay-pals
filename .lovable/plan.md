Update `src/lib/open-checkout.ts` so `openCheckoutUrl()` navigates the current tab to Stripe instead of opening a new tab.

- Remove the `window.open(url, "_blank")` path.
- Update the toast to "Redirecting to secure checkout…".
- If inside an iframe (Lovable preview) and `window.top` is reachable, set `window.top.location.href = url` so Stripe loads top-level.
- Otherwise fall back to `window.location.href = url`.
- Keep the function signature unchanged so all existing callers (PlansPage, AutopaySetupCard, BNPL, donations, vet card, customer portal, etc.) work without modification.

Stripe sessions already define `success_url` / `cancel_url` back into the app, so the user returns to the right page in the same tab after completing or cancelling.