# Client Instructions: Complete Stripe Live-Mode Setup

Send this to the client verbatim. It walks them through all 4 remaining Dashboard items. They'll need ~30–45 minutes and their business bank info, EIN/SSN, and legal address.

**Before starting:** log in at https://dashboard.stripe.com and confirm the toggle in the top-left says **Live mode** (not "Test mode").

---

## Part A — Enable Payment Methods (5 min)

1. Go to **Settings** (gear icon, top-right) → under *Payments*, click **Payment methods**.
2. **Cards** — confirm the following are green/On: Visa, Mastercard, American Express, Discover. (They should be on by default.)
3. **Link by Stripe** — click **Turn on**. No configuration needed.
4. **Apple Pay** — click **Configure** → **Add a new domain**, and add these two domains one at a time:
   - `prowebbuilders.com`
   - `pet-pay-pals.lovable.app`
   Stripe will verify automatically (both domains already load Stripe.js).
5. **Google Pay** — click **Turn on**. No configuration needed.
6. Leave everything else off (ACH, Klarna, Affirm, Afterpay, Alipay, WeChat Pay).

---

## Part B — Set Up Issuing for Vet Cards (10 min)

1. Left sidebar → **More** → **Issuing**. Click **Get started**.
2. **Program details:**
   - Business use case: *"Veterinary care financing for pet owners enrolled in Help A Pet memberships."*
   - Card types to issue: check **Virtual** and **Physical**.
3. **Card program agreement** — read and accept the **Celtic Bank Commercial Card Agreement**. (Must be signed by the business's authorized officer.)
4. **Funding source** — click **Add funding source** → link the business bank account. Add an initial balance of **$500–$2,000** (used to authorize vet card charges; can be topped up any time).
5. **Card design (physical cards):**
   - Upload logo: Help A Pet logo (navy + gold, 100×140 px, transparent PNG). *We'll email you the file.*
   - Card color: Navy Blue (`#1B2A4A`).
   - Front text: leave default (cardholder name).
6. **Spend controls (defaults):** allow MCC **0742** (Veterinary Services). Leave other categories blocked.
7. Click **Submit for review**. Approval usually takes 1–3 business days.

---

## Part C — Set Up Connect for Referrer Payouts (10 min)

1. Left sidebar → **Connect** → **Get started**.
2. Choose account type: **Platform or marketplace**.
3. **Platform profile:**
   - Platform name: **Help A Pet**
   - Business URL: `https://prowebbuilders.com`
   - Support email: *your support email*
   - Product description: *"Veterinarians, shelters, and community referrers earn bounties for onboarding pet owners to Help A Pet memberships. Payouts are sent via Stripe Connect Express accounts."*
4. **Account type your connected users will get:** **Express** (very important — our code expects Express).
5. **Branding:**
   - Logo: Help A Pet logo (same file as above).
   - Brand color: `#1B2A4A`.
   - Accent color: `#D4A843` (gold).
6. **Payout settings for connected accounts:**
   - Payout schedule: **Daily rolling** (Stripe default).
   - Statement descriptor: `HELPAPET REF`
   - Negative balance liability: **Platform**.
7. **Accept the Connect Platform Agreement.**
8. Click **Submit**. Live immediately.

---

## Part D — Recurring Product Setup (skip for now)

**No action needed today.** Our checkout code creates membership prices dynamically per transaction, so memberships will work as soon as Part A is complete. Products will auto-appear in your Product Catalog after the first live subscription.

If later you want customers to be able to upgrade/downgrade plans from their billing portal, tell us and we'll pre-create the catalog entries at that time.

---

## Part E — What to send back to us

After completing Parts A–C, send:

1. **Business address** (street, city, state, ZIP, country) — this is embedded on vet cards.
2. Screenshot of the Stripe **Setup Guide** page showing completion %.
3. Confirmation that Issuing was submitted (we'll wait for Stripe's approval email before enabling live vet card issuance).

Once we have those, we'll:
- Save the business address into the backend (secrets).
- Run a $1 live smoke test on membership checkout.
- Confirm the webhook is firing correctly end-to-end.
- Flip vet card issuance from stub mode to live once Stripe approves Issuing.

---

## Common gotchas to warn the client about

- **Live mode toggle:** if the top-left says "Test mode," none of the settings above apply to real payments. Always confirm Live mode before saving.
- **Bank account verification:** micro-deposits can take 1–2 days. Payouts won't work until verified.
- **Issuing approval delay:** the Issuing agreement goes to Stripe's underwriting team. Vet cards won't work in live mode until they email approval (typically 1–3 business days).
- **Tax setup:** Stripe will nag about Stripe Tax and 1099s. Both are optional for launch and can be added later.

---

## What I'll do after client confirms Parts A–C are done

1. Ask you for the business address, then save the 5 `ISSUING_BUSINESS_ADDRESS_*` secrets.
2. Run a live-mode connectivity check against the Stripe API from the backend.
3. Verify the webhook endpoint in the Stripe Dashboard is subscribed to all events our code handles (list is in the plan file).
4. Report back the go-live status.
