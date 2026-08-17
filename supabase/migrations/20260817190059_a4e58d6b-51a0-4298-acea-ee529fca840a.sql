ALTER TABLE public.help_now_campaigns
  ADD COLUMN IF NOT EXISTS document_basis text NOT NULL DEFAULT 'estimate',
  ADD COLUMN IF NOT EXISTS invoice_url text,
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS invoice_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS invoice_rejection_reason text,
  ADD COLUMN IF NOT EXISTS clock_paused_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_help_now_campaigns_expiry
  ON public.help_now_campaigns(status, expires_at);

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
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_help_now_campaign_fields ON public.help_now_campaigns;
CREATE TRIGGER trg_guard_help_now_campaign_fields
  BEFORE UPDATE ON public.help_now_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_help_now_campaign_fields();

INSERT INTO public.platform_settings(key, value, description)
VALUES ('help_now_expiry_job', '{}'::jsonb, 'Single-flight lease for the daily Help a Pet Now campaign expiry sweep.')
ON CONFLICT (key) DO NOTHING;