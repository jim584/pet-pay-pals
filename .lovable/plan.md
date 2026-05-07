## Fix: Stripe Checkout iframe stuck on skeleton

In the Lovable preview, the app runs inside a cross-origin iframe. Setting `window.top.location.href` throws silently on cross-origin parents, so the redirect falls through to `window.location.href = url` — which navigates the iframe itself. Stripe Checkout refuses to render in iframes, leaving the skeleton spinning forever.

### Change

Update `src/lib/open-checkout.ts` to use an anchor with `target="_top"` to break out of cross-origin iframes (the browser handles this natively without needing same-origin access):

1. Try `window.top.location.href = url` first (works on the published site / custom domain where there's no iframe, and on same-origin embeds).
2. If that throws or we're still inside an iframe, create a temporary `<a target="_top" href={url}>`, click it, then remove it. This forces the top-level browser tab to navigate to Stripe even from a cross-origin iframe.
3. Fall back to `window.location.href = url` only when not in an iframe.

No other files change — all callers already go through `openCheckoutUrl()`.