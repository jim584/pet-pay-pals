CREATE TABLE public.campaign_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.help_now_campaigns(id) ON DELETE CASCADE,
  ticket_id uuid,
  pet_id uuid,
  author_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'progress' CHECK (kind IN ('initial','treatment','progress')),
  body text NOT NULL,
  photo_urls text[] NOT NULL DEFAULT '{}',
  is_required_update boolean NOT NULL DEFAULT true,
  public_verification_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.campaign_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_updates TO authenticated;
GRANT ALL ON public.campaign_updates TO service_role;

ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read updates for published cases"
ON public.campaign_updates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.help_now_campaigns c
  WHERE c.id = campaign_updates.campaign_id AND c.status <> 'draft'
));

CREATE POLICY "Owners can read their own updates"
ON public.campaign_updates FOR SELECT
TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can post updates on their own case"
ON public.campaign_updates FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.help_now_campaigns c
    WHERE c.id = campaign_updates.campaign_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can edit their own updates"
ON public.campaign_updates FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Admins manage campaign updates"
ON public.campaign_updates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_campaign_updates_campaign ON public.campaign_updates(campaign_id, created_at DESC);

CREATE TRIGGER update_campaign_updates_updated_at
BEFORE UPDATE ON public.campaign_updates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Members may not rewrite the system-owned fields on their own updates.
CREATE OR REPLACE FUNCTION public.guard_campaign_update_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.campaign_id := OLD.campaign_id;
  NEW.ticket_id := OLD.ticket_id;
  NEW.pet_id := OLD.pet_id;
  NEW.author_id := OLD.author_id;
  NEW.kind := OLD.kind;
  NEW.is_required_update := OLD.is_required_update;
  NEW.public_verification_url := OLD.public_verification_url;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_campaign_update_fields_trg
BEFORE UPDATE ON public.campaign_updates
FOR EACH ROW EXECUTE FUNCTION public.guard_campaign_update_fields();

ALTER TABLE public.help_now_campaigns
  ADD COLUMN IF NOT EXISTS initial_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS treatment_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_required_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_update_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS update_overdue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disbursement_paused_for_update boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS update_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_verification_url text;

CREATE OR REPLACE FUNCTION public.guard_help_now_campaign_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  NEW.initial_update_at := OLD.initial_update_at;
  NEW.treatment_update_at := OLD.treatment_update_at;
  NEW.last_required_update_at := OLD.last_required_update_at;
  NEW.next_update_due_at := OLD.next_update_due_at;
  NEW.update_overdue := OLD.update_overdue;
  NEW.disbursement_paused_for_update := OLD.disbursement_paused_for_update;
  NEW.update_reminder_sent_at := OLD.update_reminder_sent_at;
  NEW.public_verification_url := OLD.public_verification_url;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;