# Referral Program — End-to-End Test Checklist

Use Stripe **test mode** (existing `STRIPE_SECRET_KEY`). All steps assume admin access.

## 1. Vet referrer (Fear Free certified) — full happy path
1. **Admin** → `/admin/referrals` → New referrer (type: Veterinarian, Fear Free certified ON). Copy referral code.
2. **Incognito** → `/auth?ref=CODE` → sign up new user (e.g. `tester+vet1@example.com`).
   - Verify in DB: `select * from referrals where referred_user_id = '<new_user_id>';` → row exists, `status=pending_signup`.
3. **New user** → subscribe to a membership plan, pay with `4242 4242 4242 4242`.
   - Verify webhook ran: `select * from payment_history where user_id = '<new_user_id>';`
   - `select * from referrals where referred_user_id = '<id>';` → `status=active`, `activated_at` set.
   - `select * from referral_bounties where referrer_id = '<ref_id>';` → row with `period=intro`, `rate=0.05`, `status=pending`.
4. **Admin** → Settings → temporarily set `Hold period (days)` to 0 → Save.
5. **Admin** → "Run hold-expiry job" → bounty status flips to `available`.

## 2. Stripe Connect payout
6. **Referrer (vet user)** → log in → `/referrer` → "Connect Stripe" → complete Stripe Express test onboarding (use test data prefilled).
7. After return: Connect status badge should show `active` (refresh if needed).
8. **Admin** → Referrers tab → click ⚡ (Stripe payout) for that referrer.
   - Verify: `select * from referrer_payouts where referrer_id='<id>';` → row with `method=stripe_connect`, `stripe_transfer_id` set.
   - Bounty rows for referrer move to `status=paid`.

## 3. Cancellation reversal (within hold)
9. New scenario: repeat steps 1–3 with a fresh user. Bounty is `pending`.
10. Cancel the user's subscription via Stripe Dashboard (test mode).
11. Webhook `customer.subscription.deleted` fires. Verify:
    - `select status from referral_bounties where referrer_id='<id>' order by created_at desc limit 1;` → `reversed`.
    - `referrals.status` → `reversed`.

## 4. Vet NOT Fear Free certified — no bounty
12. Admin → New referrer (Veterinarian, FF certified OFF).
13. Repeat signup + subscribe flow. Verify NO row appears in `referral_bounties` for this referrer (referral row is still marked `active`).

## 5. Shelter milestone payout
14. Admin → New referrer (type: Shelter).
15. Admin → Milestones tab → New milestone (select shelter, pet name "Buddy", goal $500, payout $50).
16. Click "+ Contribution" on that milestone → enter $250 → repeat with $300.
    - Verify milestone `status=completed`, `raised_amount >= goal_amount`.
    - Verify a `referral_bounties` row created with `period=milestone`, `bounty_amount=50`, `status=pending`.
17. Run hold-expiry job (or set hold to 0) → bounty becomes `available`.
18. Pay out via Stripe (if shelter has Connect) or manually.

## 6. QR code
19. Admin Referrers → click QR icon → modal shows QR + downloadable PNG.
20. Referrer Dashboard → Share tab → same QR experience.

## Tools for verification
- **DB queries:** Backend → Database → SQL editor (or `supabase--read_query`)
- **Edge function logs:** Backend → Functions → `stripe-webhook`, `referrer-payout`, `process-referral-bounties`
- **Stripe events:** Stripe Dashboard (test mode) → Developers → Events
