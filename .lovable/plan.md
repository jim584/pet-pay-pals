I found the key clue: the backend function is returning a valid Stripe Checkout URL with status 200, so the failure is not that checkout is never created. The Stripe hosted page is likely being opened inside the Lovable preview iframe/same-frame navigation, where Stripe Checkout can sit on its loading skeleton instead of rendering normally. I’ll change the app so Stripe checkout is launched as a real browser tab/window with a safe fallback instead of navigating the embedded preview frame.

Plan:

1. Add a shared checkout redirect helper
   - Create one reusable helper for external payment URLs.
   - It will open Stripe in a new top-level browser tab/window using `window.open(..., "_blank")`.
   - If the popup is blocked, it will fall back to a visible direct link/button instead of leaving the user stuck on a spinner.
   - It will also use a short timeout so buttons don’t spin forever.

2. Fix plan subscriptions
   - Update the Plans page subscribe flow to use the shared checkout launcher instead of `window.location.href = url`.
   - Keep the user on the Plans page with clear feedback: “Stripe opened in a new tab” plus a “Continue to secure checkout” fallback if needed.
   - Ensure the Subscribe button resets if redirect/opening fails.

3. Fix autopay setup
   - Update `AutopaySetupCard` to use the same checkout launcher.
   - Remove the current `_top` same-frame approach that can still get trapped in the preview/container.
   - Keep the existing return confirmation flow (`autopay=success&session_id=...`) so saved cards still self-confirm after returning.
   - Keep the existing “Continue” fallback link, but make it more explicit and reliable.

4. Fix related Stripe payment entry points to prevent the same bug elsewhere
   - Apply the same helper to payment plan installment checkout.
   - Apply it to vet ticket member-remainder checkout and donation checkout where the code uses `window.location.href` for Stripe.
   - This prevents the same Stripe skeleton issue from resurfacing from another payment button.

5. Improve user-facing failure states
   - Buttons will stop spinning if checkout does not open.
   - The user will see a clear message and a direct “Open Stripe checkout” option.
   - This avoids the current experience where the app appears to be permanently loading.

Technical details:

- The observed network request to `create-checkout` succeeded and returned a `https://checkout.stripe.com/...` URL.
- The current code redirects with `window.location.href` in several places, which can navigate only the embedded preview frame.
- Stripe Checkout is a hosted external payment page and should not be embedded in the app iframe.
- The fix is client-side and should not require database changes or new backend secrets.

After approval, I’ll implement the helper and wire it into the subscription, autopay, and payment redirect flows.

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>