## Add a "How autopay works" checklist to the empty BNPL state

In `src/pages/PaymentPlansPage.tsx`, between the description paragraph and the "Set up autopay" button (around lines 191–192) in the `obligations.length === 0` empty state, insert a short ordered list with `CheckCircle2` icons (already imported) explaining the flow:

1. Click "Set up autopay" to securely save a card via Stripe.
2. After a vet visit, any uncovered balance is split into interest-free installments.
3. Each installment is charged automatically and appears here under **Open**.
4. Paid installments move to **Closed**; you can pay early or toggle autopay anytime.

Styled with `text-sm`, left-aligned in a `max-w-md mx-auto` block, muted text, with a small primary-colored check icon per row. No other changes.
