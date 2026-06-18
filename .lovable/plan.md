## Background

Good news: the **backend flow already matches the developer notes**. Today:

- `compute-ticket-coverage` calculates Direct Pay, BNPL, Reserve, and member remainder.
- When an admin approves, `approve-vet-ticket` either marks the ticket `funded` (no remainder) or `approved` (remainder due).
- If a remainder is due, the **member** clicks **Pay your portion**, which calls `collect-member-remainder` → opens a Stripe Checkout charging the member to **Help A Pet's** account (not to the vet).
- When the Stripe webhook receives payment, ticket flips to `funded` and `issue-vet-card` is invoked to mint a **Stripe-issued virtual card** scoped to the approved amount. The vet runs that as a normal Visa transaction. A physical card can also be requested.
- The vet never collects the remainder. There's no vet-side "charge member" UI anywhere in the code.

So no business-logic, DB, or payments-plumbing change is needed. The gap is **UX/copy** — labels and microcopy on three surfaces still imply the vet might collect from the owner, or don't explain to the vet that they'll be paid via a Help A Pet card.

## Changes (UI/copy only)

### 1. Vet dashboard (`src/components/vet/VetDashboardHome.tsx`)

In the incoming-ticket coverage breakdown:

- Rename **"Owner portion"** → **"Collected by Help A Pet"**.
- Add a one-line note under the breakdown:
  > "You don't collect any of this from the pet owner. Once funded, Help A Pet pays you via a Visa card issued to this ticket."

### 2. Admin ticket review (`src/pages/AdminVetTicketsPage.tsx`)

The editable coverage grid currently labels the field `member remainder`. Keep the field key, but render the label as **"Member remainder (charged by Help A Pet)"** so admins and any vet who later sees this know the source.

### 3. Member ticket card (`src/pages/VetTicketsPage.tsx`)

The member-facing TicketCard already routes the remainder to Help A Pet, but the wording is generic. Update:

- Breakdown row: **"Your portion"** → **"Your portion (paid to Help A Pet)"**.
- Button: **"Pay your portion"** → **"Pay your portion to Help A Pet"**.
- Below the button, add a short helper line:
  > "We charge your card on file. Once paid, Help A Pet issues a Visa card that the clinic runs as a normal card transaction."
- On `status === "funded"` and `card_issued`, tighten the existing copy:
  - `funded`: "Funded — Help A Pet is issuing the clinic's Visa card now."
  - `card_issued`: keep the existing "View vet card" CTA, plus a single line: "Share the card details with your clinic — they run it like any other Visa."

### 4. Vet card detail (`src/pages/VetCardPage.tsx`)

Add a single helper line near the card details:
> "Hand these card details to the clinic. They process it as a standard Visa transaction — no special software or onboarding required."

## Out of scope

- No changes to `compute-ticket-coverage`, `approve-vet-ticket`, `collect-member-remainder`, `issue-vet-card`, `stripe-webhook`, or any database table/policy. The flow is already correct.
- No changes to BNPL allocation, reserve logic, or fee splits.

Once approved I'll make these copy changes in one pass.
