I checked the current payment plan code, the session replay, and the network requests. The data query itself is returning quickly with an empty `bnpl_obligations` list, so the previous empty-state fix works for the initial page load. The remaining problem is the autopay flow: clicking **Set up autopay** successfully gets a hosted checkout URL, but the UI assumes the browser will immediately leave the page. If that redirect is blocked, delayed, or returns without the webhook/card status being ready yet, the user can be left staring at a loading/skeleton/busy state with no clear recovery.

Plan to fix it properly:

1. Harden `/dashboard/payment-plans` loading so it cannot skeleton forever
   - Change the page from a simple `loading: true/false` flag to an explicit load state: `loading`, `ready`, `empty`, `error`.
   - Always clear loading in every path, including missing user, no obligations, partial installment failures, and retries.
   - Use the authenticated user from `useAuth()` directly instead of re-fetching the user during page load.
   - Load installments with `Promise.allSettled` so one failed installment query does not keep the whole page stuck.
   - Add a timeout guard that converts long loads into a clear retry/error card instead of endless skeletons.

2. Make the autopay checkout handoff resilient
   - In `AutopaySetupCard`, do not leave the button in a permanent spinner after receiving the checkout URL.
   - Store the returned hosted checkout URL in component state and show a visible fallback card/link: “Continue to secure card setup”.
   - Attempt the automatic redirect, but if the user remains on the app, reset the spinner and keep the manual link visible.
   - Use a safer navigation method for external checkout so embedded preview/browser restrictions do not trap the user on the dashboard page.

3. Fix return-from-autopay behavior
   - Handle `?autopay=success`, `?autopay=cancelled`, and `session_id` on `/dashboard/payment-plans`.
   - Strip those query params after processing so refreshes do not retrigger stale loading/toasts.
   - After success, poll the saved-card status a few times because the payment provider webhook can arrive slightly after the redirect back.
   - If the card is not confirmed yet, show a clear “Card setup is still confirming” message instead of showing skeletons.

4. Add route compatibility for stale/incorrect URLs
   - Add a redirect alias from `/dashboard/paymentplans` to `/dashboard/payment-plans`, since that non-hyphen path was previously mentioned and may still exist in stale links or redirects.
   - This prevents users from landing on the wrong route and thinking the Payment Plans page is broken.

5. Add explicit authorization/empty messaging
   - Keep unauthenticated users redirected to login.
   - If a signed-in user has no role yet, send them to role selection.
   - If a non-pet-owner reaches the pet-owner payment plans route, show a clear unauthorized/role-specific message rather than a loader.
   - Keep the empty state visible when there are no BNPL obligations, with the autopay setup card still usable.

6. Verify the actual flow
   - Load `/dashboard/payment-plans` with a pet-owner account that has no obligations and confirm it shows the empty state, not skeletons.
   - Click **Set up autopay** and confirm the checkout URL handoff either redirects or shows the fallback “Continue” link.
   - Return with `autopay=success` and confirm the page shows card-status confirmation/loading text briefly, then resolves to the empty state or real obligations.
   - Confirm `/dashboard/paymentplans` redirects to `/dashboard/payment-plans`.

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>