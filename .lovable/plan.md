## Admin Payment Plans (BNPL) Management

Build an admin section to review and manage every Buy-Now-Pay-Later obligation (`bnpl_obligations`), including agreement statuses, outstanding balances, and payment history.

### Current Model

- Table `bnpl_obligations`: one row per obligation tied to a `vet_ticket`. Fields: `provider`, `original_amount`, `outstanding_amount`, `status` (enum: `pending | active | paid_off | defaulted | cancelled`), `external_ref`.
- Today obligations are auto-created when a vet ticket is approved (`approve-vet-ticket` edge function) and released back via `release_ticket_allocations`. There is no per-installment ledger.

### Database Migration — add a payment-history sub-table

```sql
CREATE TABLE public.bnpl_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES public.bnpl_obligations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL DEFAULT 'manual',
  external_ref TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bnpl_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bnpl payments" ON public.bnpl_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners view own bnpl payments" ON public.bnpl_payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bnpl_obligations o
    WHERE o.id = bnpl_payments.obligation_id AND o.owner_id = auth.uid()
  ));
```

Plus two SECURITY DEFINER triggers (`apply_bnpl_payment` on INSERT, `revert_bnpl_payment` on DELETE) that recompute `outstanding_amount = original − SUM(payments)` and flip status:
- → `paid_off` when outstanding hits zero
- `pending` → `active` on first payment
- on delete: `paid_off` → `active` if outstanding becomes positive again

### API Layer (`src/lib/admin-api.ts`)

- `fetchAdminBnpl(filter, search)` — list obligations joined with owner profile, pet name, and originating ticket's clinic.
- `fetchAdminBnplStats()` — total plans, active count, total outstanding, defaulted count, paid-off count.
- `fetchBnplPayments(obligationId)` — payment history.
- `recordBnplPayment(obligationId, { amount, method, external_ref?, notes? })` — INSERT; trigger recomputes status.
- `deleteBnplPayment(paymentId)` — DELETE; trigger recomputes.
- `updateAdminBnpl(id, { status?, outstanding_amount?, provider?, external_ref? })` — manual overrides.

### UI

**New route:** `/admin/payment-plans` → `AdminPaymentPlansPage.tsx`

**Sidebar:** add "Payment Plans" entry between Payments and Wallet & Reserve (icon: `CalendarClock`).

**Page layout:**
- Header + 4 stat cards: Total plans · Outstanding (sum) · Defaulted · Paid off.
- Status tabs: All / Pending / Active / Paid off / Defaulted / Cancelled.
- Search by owner, pet, clinic, or external ref.
- Plan rows with: owner avatar+name, pet, clinic, status badge, provider chip, created date, outstanding/original amounts, paid-progress bar.
- Per-row actions: **Record payment**, **View payments**, **Edit** (status / outstanding / provider / ref), **Mark defaulted**, **Cancel plan**, **View ticket**.

**Dialogs:**
- *Record payment* — amount + method + optional external ref + notes.
- *Payment history* — list of `bnpl_payments` with delete-per-row (admin only). Shows running balance.
- *Edit plan* — status select, outstanding (number), provider, external ref.
- AlertDialog confirmations for "Mark defaulted" and "Cancel plan".

### Wiring

- Update `src/App.tsx`: add `<Route path="payment-plans" element={<AdminPaymentPlansPage />} />` under the `/admin` group.
- Update `src/components/admin/AdminSidebar.tsx` nav array.
- All mutations show toasts and refresh the list.

### Out of Scope

- Automatic recurring billing or Stripe webhook integration for BNPL providers (manual record-payment only for now).
- Customer-facing payment plan portal (admin-only this loop).
- Notifications/reminders for overdue plans.