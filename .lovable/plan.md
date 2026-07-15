# Stripe Live-Mode Configuration Plan

You'll complete these four items in the client's Stripe Dashboard (admin access). Live keys are already saved in the backend, so once these are done the app is fully live.

**Order matters** — do them top to bottom. Each depends on the previous.

---

## 1. Set up Payments (cards + Apple Pay/Link)

**Where:** Dashboard → Settings → Payments → Payment methods (make sure toggle at top says **Live mode**)

**Steps:**
1. **Cards** — confirm Visa/Mastercard/Amex/Discover are all **On** for live mode.
2. **Link** — toggle **On** (one-click checkout, no extra setup).
3. **Apple Pay** — click **Configure** → **Add a new domain** → enter the production domain(s):
   - `prowebbuilders.com`
   - `pet-pay-pals.lovable.app`
   Stripe will give a verification file URL. That file is auto-served by Stripe when the domain uses Stripe.js/Checkout (which this app does), so verification should pass immediately. If it doesn't, we'll add a hosted verification file.
4. **Google Pay** — toggle **On** (no domain setup needed when using Stripe Checkout).

**Skip:** ACH, wallets like Alipay/WeChat, BNPL providers (Affirm/Klarna/Afterpay) — not used by the app.

---

## 2. Create the Recurring Product (memberships)

**Where:** Dashboard → Product catalog → **+ Add product** (live mode)

Membership plans are stored in our DB (`membership_plans` table) with `membership_fee`, `platform_fee_monthly`, `platform_fee_annual`, per-species/per-tier. Stripe needs matching **Products + Prices** so `create-checkout` can reference them.

**Approach:** I'll query `membership_plans` first and generate the exact list of Products/Prices you need to create, with names, amounts, and intervals. Then in build mode I'll wire the resulting `stripe_price_id_monthly` / `stripe_price_id_annual` columns back into the DB.

**Rough shape** (8 plans × 2 intervals = 16 prices, e.g.):
- Product: *Together Membership — Dog Bronze* → Prices: `$X/month`, `$Y/year`
- Product: *Together Membership — Cat Gold* → Prices: `$X/month`, `$Y/year`
- …etc.

Tax code for each: `txcd_10000000` (General - Services) unless you want SaaS treatment.

---

## 3. Set up Issuing (vet cards)

**Where:** Dashboard → Issuing → **Get started**

**Steps:**
1. Accept the **Celtic Bank Commercial Card Agreement** (must be signed by the client's authorized rep — if you're the admin but not the principal, ping the client to click Accept; you can prep everything else).
2. **Program details** — Business use case: "Veterinary care financing for pet owners." Card type: **Virtual + Physical**.
3. **Funding** — link the same bank account used for payouts. Fund an initial Issuing balance (recommend $500–$2,000 to start; the app authorizes per-ticket approved amounts).
4. **Card program design** — upload the Help A Pet logo (100x140 navy/gold per brand memory) for physical cards. Physical card name line: cardholder's full name.
5. **Spend controls (defaults)** — MCC 0742 (Veterinary Services). Our code already sets per-card `allowed_merchants` or `allowed_categories: ["veterinary_services"]`, so Dashboard defaults just need to permit that MCC.
6. Confirm `ISSUING_ENABLED=true` in backend secrets (already set per prior audit).

---

## 4. Build Connect Integration (referrer payouts)

**Where:** Dashboard → Connect → **Get started** (live mode)

**Steps:**
1. **Platform profile:**
   - Platform name: *Help A Pet*
   - Public business URL: `https://prowebbuilders.com`
   - Support email: (client's)
   - Product description: "Referrers earn bounties for onboarding pet owners to Help A Pet memberships. Payouts sent via Stripe Connect Express."
2. **Accept the Connect platform agreement** (again, client must click if you're not the principal).
3. **Account type:** **Express** (matches `referrer-connect-onboard/index.ts`).
4. **Branding** — logo + brand color (`#1B2A4A`) shown during referrer onboarding.
5. **Payout schedule for connected accounts:** **Manual** (our `referrer-payout` function triggers transfers via admin action; connected accounts then payout on Stripe's default daily rolling).
6. **Negative balance liability:** **Platform** (standard — we already reconcile bounties before transferring).
7. **Statement descriptor** for connected accounts: `HELPAPET REF`.

**No webhook changes needed** — `stripe-webhook` already handles `account.updated` and `transfer.*` events.

---

## Verification I'll do afterwards (build mode)

1. Query `membership_plans` and generate the exact Products/Prices list before you create them.
2. After you create them, add `stripe_price_id_monthly` / `stripe_price_id_annual` columns to `membership_plans` (if not present) and I'll populate them.
3. Run `stripe.accounts.retrieve()` against a test Connect onboarding to confirm capabilities enabled.
4. Confirm `ISSUING_ENABLED`, `ISSUING_BUSINESS_ADDRESS_*` secrets are set; add any missing ones.
5. Check `stripe-webhook` endpoint in Dashboard is subscribed to: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, `account.updated`, `transfer.created`, `issuing_authorization.request`, `issuing_transaction.created`.

---

## What I need from the client (not you)

Only the two agreement clicks (Issuing Celtic Bank, Connect platform agreement) if you're not the account principal. Everything else you can do with admin access.

## Deliverable at end

- All 4 Dashboard items green
- Membership Price IDs stored in DB
- Webhook subscriptions verified against code
- One end-to-end live smoke test: $1 test membership checkout → webhook → DB row → customer portal loads
