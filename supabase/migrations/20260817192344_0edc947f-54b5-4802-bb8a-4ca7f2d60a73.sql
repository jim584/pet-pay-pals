-- Requirement 12: invoice + proof of payment before disbursement

ALTER TABLE public.help_now_campaigns
  ADD COLUMN IF NOT EXISTS disbursement_path text NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS proof_of_payment_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS proof_of_payment_url text,
  ADD COLUMN IF NOT EXISTS proof_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS proof_rejection_reason text,
  ADD COLUMN IF NOT EXISTS disbursement_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS disbursement_block_reason text;

ALTER TABLE public.help_now_campaigns
  DROP CONSTRAINT IF EXISTS help_now_campaigns_disbursement_path_check;
ALTER TABLE public.help_now_campaigns
  ADD CONSTRAINT help_now_campaigns_disbursement_path_check
  CHECK (disbursement_path IN ('unset','direct_vet','member_reimbursement'));

ALTER TABLE public.help_now_campaigns
  DROP CONSTRAINT IF EXISTS help_now_campaigns_proof_status_check;
ALTER TABLE public.help_now_campaigns
  ADD CONSTRAINT help_now_campaigns_proof_status_check
  CHECK (proof_of_payment_status IN ('none','submitted','verified','rejected','flagged'));

UPDATE public.help_now_campaigns
  SET disbursement_block_reason = COALESCE(
    disbursement_block_reason,
    'Awaiting direct vet payment or verified proof of payment'
  )
  WHERE disbursement_eligible_at IS NULL;

CREATE TABLE IF NOT EXISTS public.campaign_disbursement_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.help_now_campaigns(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.vet_tickets(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('invoice','proof_of_payment')),
  storage_path text NOT NULL,
  review_status text NOT NULL DEFAULT 'submitted'
    CHECK (review_status IN ('submitted','verified','rejected','flagged')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_disbursement_documents_campaign_idx
  ON public.campaign_disbursement_documents(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_disbursement_documents_status_idx
  ON public.campaign_disbursement_documents(review_status);

GRANT SELECT, INSERT ON public.campaign_disbursement_documents TO authenticated;
GRANT ALL ON public.campaign_disbursement_documents TO service_role;

ALTER TABLE public.campaign_disbursement_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their campaign documents"
  ON public.campaign_disbursement_documents FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.help_now_campaigns c
      WHERE c.id = campaign_id AND c.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners add their campaign documents"
  ON public.campaign_disbursement_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.help_now_campaigns c
        WHERE c.id = campaign_id AND c.owner_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Admins manage campaign documents"
  ON public.campaign_disbursement_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete campaign documents"
  ON public.campaign_disbursement_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER campaign_disbursement_documents_updated_at
  BEFORE UPDATE ON public.campaign_disbursement_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Members may never set verification / eligibility fields themselves.
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
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;