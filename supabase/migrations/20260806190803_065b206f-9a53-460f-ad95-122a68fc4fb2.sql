ALTER TYPE public.vet_ticket_status ADD VALUE IF NOT EXISTS 'needs_info';

ALTER TABLE public.vet_tickets
  ADD COLUMN IF NOT EXISTS info_request_message text,
  ADD COLUMN IF NOT EXISTS info_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS info_requested_by uuid,
  ADD COLUMN IF NOT EXISTS info_response_message text,
  ADD COLUMN IF NOT EXISTS info_responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_vet_ticket_protected_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  OR NEW.info_request_message IS DISTINCT FROM OLD.info_request_message
  OR NEW.info_requested_at  IS DISTINCT FROM OLD.info_requested_at
  OR NEW.info_requested_by  IS DISTINCT FROM OLD.info_requested_by
  OR NEW.info_response_message IS DISTINCT FROM OLD.info_response_message
  OR NEW.info_responded_at  IS DISTINCT FROM OLD.info_responded_at
  THEN
    RAISE EXCEPTION 'Protected vet ticket fields can only be changed by a server command';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status <> 'cancelled'::vet_ticket_status THEN
    RAISE EXCEPTION 'Ticket status transitions are server-controlled';
  END IF;

  RETURN NEW;
END;
$function$;