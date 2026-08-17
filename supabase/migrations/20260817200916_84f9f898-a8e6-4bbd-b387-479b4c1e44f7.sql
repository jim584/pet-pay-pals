-- Requirement 14: framework for the Help a Pet Now priority hierarchy.
-- The official ranking criteria are supplied separately; these columns only
-- provide the place to store an assigned/calculated priority and the
-- eligibility facts a future rule would read.

ALTER TABLE public.help_now_campaigns
  ADD COLUMN IF NOT EXISTS priority_rank INTEGER,
  ADD COLUMN IF NOT EXISTS priority_source TEXT NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS priority_computed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority_inputs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.help_now_campaigns.priority_rank IS
  'Assigned or calculated Help a Pet Now priority. Lower value = higher priority. NULL = unranked. No formula is defined yet (Requirement 14).';
COMMENT ON COLUMN public.help_now_campaigns.priority_source IS
  'unset | admin | rule — where priority_rank came from.';

CREATE INDEX IF NOT EXISTS idx_help_now_campaigns_priority
  ON public.help_now_campaigns(priority_rank NULLS LAST);

-- Members must not be able to set their own case's priority. The existing
-- field guard reverts protected columns for non-admin callers.
CREATE OR REPLACE FUNCTION public.guard_help_now_campaign_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.ticket_id := OLD.ticket_id;
  NEW.pet_id := OLD.pet_id;
  NEW.owner_id := OLD.owner_id;
  NEW.goal_amount := OLD.goal_amount;
  NEW.raised_amount := OLD.raised_amount;
  NEW.status := OLD.status;
  NEW.verification_status := OLD.verification_status;
  NEW.published_at := OLD.published_at;
  NEW.expires_at := OLD.expires_at;
  NEW.document_basis := OLD.document_basis;
  NEW.invoice_url := OLD.invoice_url;
  NEW.invoice_status := OLD.invoice_status;
  NEW.invoice_submitted_at := OLD.invoice_submitted_at;
  NEW.invoice_reviewed_at := OLD.invoice_reviewed_at;
  NEW.invoice_reviewed_by := OLD.invoice_reviewed_by;
  NEW.invoice_rejection_reason := OLD.invoice_rejection_reason;
  NEW.clock_paused_at := OLD.clock_paused_at;
  NEW.verified_amount := OLD.verified_amount;
  NEW.verified_amount_source := OLD.verified_amount_source;
  NEW.funding_offsets := OLD.funding_offsets;
  NEW.over_raised_flagged_at := OLD.over_raised_flagged_at;
  NEW.disbursement_path := OLD.disbursement_path;
  NEW.proof_of_payment_status := OLD.proof_of_payment_status;
  NEW.proof_of_payment_url := OLD.proof_of_payment_url;
  NEW.proof_submitted_at := OLD.proof_submitted_at;
  NEW.proof_reviewed_at := OLD.proof_reviewed_at;
  NEW.proof_reviewed_by := OLD.proof_reviewed_by;
  NEW.proof_rejection_reason := OLD.proof_rejection_reason;
  NEW.disbursement_eligible_at := OLD.disbursement_eligible_at;
  NEW.disbursement_block_reason := OLD.disbursement_block_reason;
  NEW.priority_rank := OLD.priority_rank;
  NEW.priority_source := OLD.priority_source;
  NEW.priority_computed_at := OLD.priority_computed_at;
  NEW.priority_inputs := OLD.priority_inputs;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;