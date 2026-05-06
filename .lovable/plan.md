# Fix: "Manage Subscription" opens an empty page

## Diagnosis

I tested the `customer-portal` edge function directly as your logged-in user. It works correctly and returns this valid URL:

```
https://billing.stripe.com/p/session/test_YWNjdF8xVENQYkJBRHVQRVFmcWZxLF9VVDVqemxQMlZDVkxoZlJGTllFWm9qaFd5T001c1JV0100jVqZdVQC
```

So the code, auth, and Stripe customer lookup are all fine. The blank page comes from **Stripe's side**: in test mode, the Customer Billing Portal must be activated in the Stripe Dashboard once before any session URLs will render. Until then, Stripe responds with a valid session link that loads an empty portal page — exactly what you're seeing.

## Required action (you, in Stripe Dashboard — one-time)

1. Open https://dashboard.stripe.com/test/settings/billing/portal
2. Make sure you are in **Test mode** (toggle in top-right).
3. Configure at minimum:
   - Business information (name + a privacy/terms URL — can be your homepage)
   - Functionality: enable **Customers can update payment methods** and **Customers can cancel subscriptions** (whatever options you want exposed)
4. Click **Save**.
5. Return to /dashboard/wallet and click **Manage subscription** again — the portal will now render.

For live mode later, repeat the same at https://dashboard.stripe.com/settings/billing/portal.

## Code improvements (small, defensive)

While confirming the diagnosis, I noticed two small UX gaps in the flow worth fixing so future failures are not silent:

1. **`src/components/wallet/WalletView.tsx` — `handleManageSubscription`**
   Currently does `window.location.href = url` which navigates away even if Stripe later returns a bad URL. Switch to `window.open(url, "_blank", "noopener,noreferrer")` so the user keeps the wallet tab and can see toasts on failure. Reset `portalLoading` in a `finally`.

2. **`supabase/functions/customer-portal/index.ts`**
   Wrap the `stripe.billingPortal.sessions.create(...)` call in a try/catch that detects Stripe's `"No configuration provided"` error and returns a clearer 400 message like:
   `"Stripe Customer Portal is not configured. Open https://dashboard.stripe.com/test/settings/billing/portal and save a configuration."`
   The frontend already toasts on `error`, so this surfaces the real cause instead of an empty page.

## Steps once approved

1. Edit `src/components/wallet/WalletView.tsx` — open portal in a new tab + always reset loading state.
2. Edit `supabase/functions/customer-portal/index.ts` — friendlier error when portal is not configured.
3. Ask you to complete the Stripe Dashboard portal setup above and re-test.

No DB migrations, no new secrets, no schema changes.
