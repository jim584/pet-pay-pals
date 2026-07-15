# Update client Stripe setup guide

Edit `.lovable/plan.md` so the client sees a 1:1 mapping between Stripe's Setup Guide checklist and our instructions.

## Changes

### 1. Insert new Part 0 — Add business bank account (before Part A)

Rationale: Stripe lists "Set up banking data" as its own checklist item. It's a prerequisite for both platform payouts and the Issuing funding source, so it belongs first.

Content:

> ## Part 0 — Add your business bank account (5 min)
>
> Stripe uses this account for two things: (1) depositing platform revenue (membership payments), and (2) funding vet card authorizations (Issuing).
>
> 1. Top-right gear → **Settings** → **Business** → **Bank accounts and debit cards**.
> 2. Click **Add bank account**. Choose **United States** / **USD**.
> 3. Enter the Help A Pet business checking account: routing number + account number, or link via Plaid (instant verification).
> 4. If entered manually, Stripe sends two micro-deposits within 1–2 business days. Come back and enter the amounts to verify.
> 5. Set this account as the **default for payouts**.
>
> You'll reuse this same bank account as the Issuing funding source in Part B.

### 2. Rename Part C heading

From:
> ## Part C — Set Up Connect for Referrer Payouts (10 min)

To:
> ## Part C — Build your Connect integration (Referrer Payouts) (10 min)

Body stays the same — it already covers everything Stripe's "Build your Connect integration" checklist item asks for.

### 3. Update Part E checklist

Add a line at the top of the "send back to us" list:
> 0. Confirmation that the business bank account is **verified** (not just added).

### 4. Update the "Common gotchas" bullet on bank verification

Reword slightly to point at Part 0 explicitly:
> **Bank account verification:** if you entered account/routing manually in Part 0, micro-deposits take 1–2 days. Platform payouts and Issuing funding won't work until verified.

## Files touched

- `.lovable/plan.md` — 4 edits above. No code changes.
