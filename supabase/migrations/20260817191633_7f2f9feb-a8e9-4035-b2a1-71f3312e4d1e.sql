ALTER TABLE public.help_now_campaigns
  ADD COLUMN IF NOT EXISTS verified_amount numeric,
  ADD COLUMN IF NOT EXISTS verified_amount_source text,
  ADD COLUMN IF NOT EXISTS funding_offsets jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS over_raised_flagged_at timestamptz;

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
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_help_now_funding_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.raised_amount < 0 THEN
    RAISE EXCEPTION 'raised_amount cannot be negative';
  END IF;

  -- A campaign may never raise more than the eligible veterinary amount it is
  -- fundraising for. Reaching the cap closes the campaign to further funding.
  IF NEW.goal_amount > 0 AND NEW.raised_amount > NEW.goal_amount THEN
    RAISE EXCEPTION 'raised_amount (%) cannot exceed the eligible goal_amount (%)',
      NEW.raised_amount, NEW.goal_amount;
  END IF;

  IF NEW.goal_amount > 0
     AND NEW.raised_amount >= NEW.goal_amount
     AND NEW.status IN ('published', 'draft') THEN
    NEW.status := 'funded'::public.help_now_campaign_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_help_now_funding_cap ON public.help_now_campaigns;
CREATE TRIGGER trg_enforce_help_now_funding_cap
  BEFORE INSERT OR UPDATE ON public.help_now_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_help_now_funding_cap();

CREATE INDEX IF NOT EXISTS idx_help_now_campaigns_over_raised
  ON public.help_now_campaigns(over_raised_flagged_at)
  WHERE over_raised_flagged_at IS NOT NULL;