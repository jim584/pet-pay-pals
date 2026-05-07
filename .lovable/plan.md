I’m sorry — the last iframe breakout approach appears to be blocked in the preview/browser context, so the checkout URL is created successfully but the navigation never happens. I’ll revert that fragile part and switch to the more reliable same-tab redirect pattern.

Plan:

1. Replace the current iframe/top-frame redirect helper
   - Update `src/lib/open-checkout.ts` so it no longer tries `window.top.location` or a synthetic `<a target="_top">` click.
   - Use direct same-window navigation only: `window.location.assign(url)` with `window.location.href = url` as fallback.
   - Keep the “Redirecting to secure checkout” toast.

2. Make checkout actions fail visibly instead of silently
   - If the redirect helper is given an empty/invalid URL, show an error toast and return `false`.
   - If navigation throws, show a clear error toast telling the user to try again or use the fallback link where available.

3. Update remaining Stripe/payment entry points for consistency
   - Replace remaining payment-related `window.open(..., "_blank")` calls with the shared same-tab helper where the URL is a Stripe Checkout/Billing Portal URL.
   - Leave non-payment file previews and invoice/PDF links alone if they are intentionally documents.

4. Add a fallback link where the UI can keep state
   - For components that already store the checkout URL, make the fallback link open in the same tab instead of a new tab.
   - This gives users a manual “Open Stripe checkout” path if browser navigation is blocked.

Expected result:
- Stripe checkout/billing portal will open in the current app tab instead of a new tab.
- In the Lovable preview, it may replace the preview iframe rather than the whole editor tab, but it will no longer try to render Stripe inside an embedded frame via a broken skeleton state.
- On the published site/custom domain, it will navigate the actual browser tab to Stripe and return to the app through the existing success/cancel URLs.