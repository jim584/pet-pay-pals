## Problem

When the user clicks Subscribe / Autopay / Donate, Stripe opens correctly in a new tab — but the original app tab also gets navigated to Stripe's loading skeleton, leaving the app in a broken empty state.

The cause is in `src/lib/open-checkout.ts`. After successfully calling `window.open(url, "_blank")`, the helper still falls through to `window.top.location.href = url` / `window.location.href = url` in some code paths and timing conditions, which navigates the original tab to Stripe.

## Fix

Rework `openCheckoutUrl` so the original app tab is **never** navigated, while still guaranteeing the user can reach Stripe whether or not popups are allowed.

New behavior:

1. Call `const win = window.open(url, "_blank", "noopener,noreferrer")`.
2. **If `win` is truthy (popup opened):**
   - Show the existing toast: "Opening secure checkout — Stripe opened in a new tab."
   - Return. Do nothing to the current tab. (No more `window.location.href` fallback.)
3. **If `win` is null (popup blocked):**
   - The user sees nothing happen, so we must surface a clear, clickable way to continue.
   - Show a sonner toast with `duration: Infinity` containing:
     - Title: "Popup blocked"
     - Description: "Your browser blocked the checkout window. Click Continue to open it."
     - An action button labeled **Continue to checkout** that calls `window.open(url, "_blank")` from the click handler (a fresh user gesture, which browsers allow).
   - Return `false`.

This way:
- **Popups allowed (the normal case):** Stripe opens in a new tab, app tab stays put. No confusion.
- **Popups blocked:** A persistent toast appears in the app tab with a Continue button. One click opens Stripe in a new tab. The app tab still never navigates away.

## Why not navigate the top frame as a fallback?

The previous fallback (`window.top.location.href = url`) is exactly what causes the user-reported bug: it replaces the app with Stripe's skeleton. Browsers reliably allow `window.open` from a direct click handler, so the popup-blocked path is rare in practice. When it does happen, a persistent toast with a one-click retry is a better UX than silently swapping the app for Stripe.

## Files to change

- `src/lib/open-checkout.ts` — remove both `window.top.location.href` and `window.location.href` fallbacks; replace with a persistent sonner toast that has a "Continue to checkout" action button.

No callers need changes — `PlansPage`, `PaymentPlansPage`, `AutopaySetupCard`, `HelpOvercomePage`, and `VetTicketsPage` all already use `openCheckoutUrl` and inherit the new behavior.