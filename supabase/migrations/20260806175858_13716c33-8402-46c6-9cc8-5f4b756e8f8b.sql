-- =============================================================
-- Tier 1 security hardening: server-authoritative protected state
-- =============================================================

-- 1. VET TICKETS ------------------------------------------------
-- Clients may only create a plain 'submitted' ticket and may only
-- cancel it. All financial/state fields become server-only.

DROP POLICY IF EXISTS "Owners create own tickets" ON public.vet_tickets;
CREATE POLICY "Owners create own tickets"
ON public.vet_tickets FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND status = 'submitted'::vet_ticket_status
  AND approved_amount IS NULL
  AND coverage_breakdown IS NULL
  AND card_id IS NULL
  AND issued_card_id IS NULL
  AND authorized_until IS NULL
  AND member_remainder_paid = false
  AND member_remainder_stripe_session_id IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND admin_notes IS NULL
  AND rejection_reason IS NULL
  AND last_authorization_id IS NULL
  AND auto_approval_blockers IS NULL
);

DROP POLICY IF EXISTS "Owners cancel own tickets" ON public.vet_tickets;
CREATE POLICY "Owners cancel own tickets"
ON public.vet_tickets FOR UPDATE TO authenticated
USING (
  auth.uid() = owner_id
  AND status = ANY (ARRAY['submitted'::vet_ticket_status, 'under_review'::vet_ticket_status])
)
WITH CHECK (
  auth.uid() = owner_id
  AND status = 'cancelled'::vet_ticket_status
);

-- Defence in depth: a trigger that rejects any change to a protected
-- column by a non-admin JWT session. Service-role callers (edge
-- functions) have a NULL auth.uid() and are unaffected.
CREATE OR REPLACE FUNCTION public.guard_vet_ticket_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side (service role) and admins are trusted.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id           IS DISTINCT FROM OLD.owner_id
  OR NEW.pet_id             IS DISTINCT FROM OLD.pet_id
  OR NEW.membership_id      IS DISTINCT FROM OLD.membership_id
  OR NEW.estimate_amount    IS DISTINCT FROM OLD.estimate_amount
  OR NEW.approved_amount    IS DISTINCT FROM OLD.approved_amount
  OR NEW.coverage_breakdown IS DISTINCT FROM OLD.coverage_breakdown
  OR NEW.member_remainder_paid IS DISTINCT FROM OLD.member_remainder_paid
  OR NEW.member_remainder_stripe_session_id IS DISTINCT FROM OLD.member_remainder_stripe_session_id
  OR NEW.card_id            IS DISTINCT FROM OLD.card_id
  OR NEW.issued_card_id     IS DISTINCT FROM OLD.issued_card_id
  OR NEW.authorized_until   IS DISTINCT FROM OLD.authorized_until
  OR NEW.clinic_merchant_id IS DISTINCT FROM OLD.clinic_merchant_id
  OR NEW.merchant_lock_type IS DISTINCT FROM OLD.merchant_lock_type
  OR NEW.last_authorization_id IS DISTINCT FROM OLD.last_authorization_id
  OR NEW.auto_approval_blockers IS DISTINCT FROM OLD.auto_approval_blockers
  OR NEW.bnpl_denied_all_providers IS DISTINCT FROM OLD.bnpl_denied_all_providers
  OR NEW.admin_notes        IS DISTINCT FROM OLD.admin_notes
  OR NEW.rejection_reason   IS DISTINCT FROM OLD.rejection_reason
  OR NEW.reviewed_by        IS DISTINCT FROM OLD.reviewed_by
  OR NEW.reviewed_at        IS DISTINCT FROM OLD.reviewed_at
  THEN
    RAISE EXCEPTION 'Protected vet ticket fields can only be changed by a server command';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'cancelled'::vet_ticket_status THEN
    RAISE EXCEPTION 'Ticket status transitions are server-controlled';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vet_ticket_protected_fields ON public.vet_tickets;
CREATE TRIGGER trg_guard_vet_ticket_protected_fields
BEFORE UPDATE ON public.vet_tickets
FOR EACH ROW EXECUTE FUNCTION public.guard_vet_ticket_protected_fields();


-- 2. BNPL OBLIGATIONS -------------------------------------------
-- The member update policy previously allowed rewriting any column,
-- including outstanding balance and status. Restrict it to the
-- autopay toggle only.
CREATE OR REPLACE FUNCTION public.guard_bnpl_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id            IS DISTINCT FROM OLD.owner_id
  OR NEW.pet_id              IS DISTINCT FROM OLD.pet_id
  OR NEW.ticket_id           IS DISTINCT FROM OLD.ticket_id
  OR NEW.provider            IS DISTINCT FROM OLD.provider
  OR NEW.original_amount     IS DISTINCT FROM OLD.original_amount
  OR NEW.outstanding_amount  IS DISTINCT FROM OLD.outstanding_amount
  OR NEW.status              IS DISTINCT FROM OLD.status
  OR NEW.external_ref        IS DISTINCT FROM OLD.external_ref
  OR NEW.installment_count   IS DISTINCT FROM OLD.installment_count
  OR NEW.installment_interval_days IS DISTINCT FROM OLD.installment_interval_days
  OR NEW.next_due_date       IS DISTINCT FROM OLD.next_due_date
  OR NEW.default_at          IS DISTINCT FROM OLD.default_at
  OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
  OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
  OR NEW.paused              IS DISTINCT FROM OLD.paused
  OR NEW.paused_at           IS DISTINCT FROM OLD.paused_at
  OR NEW.paused_reason       IS DISTINCT FROM OLD.paused_reason
  OR NEW.plan_term_months    IS DISTINCT FROM OLD.plan_term_months
  OR NEW.last_payment_attempt_at IS DISTINCT FROM OLD.last_payment_attempt_at
  THEN
    RAISE EXCEPTION 'Only the autopay setting can be changed directly; all other BNPL fields are server-controlled';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_bnpl_protected_fields ON public.bnpl_obligations;
CREATE TRIGGER trg_guard_bnpl_protected_fields
BEFORE UPDATE ON public.bnpl_obligations
FOR EACH ROW EXECUTE FUNCTION public.guard_bnpl_protected_fields();


-- 3. DONATIONS ---------------------------------------------------
-- process_donation increases wallet balances with no proof of payment.
-- It must never be reachable from a browser session; only server
-- commands running after a verified Stripe charge may call it.
REVOKE ALL ON FUNCTION public.process_donation(uuid, uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_donation(uuid, uuid, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.process_donation(uuid, uuid, numeric, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_donation(uuid, uuid, numeric, uuid) TO service_role;