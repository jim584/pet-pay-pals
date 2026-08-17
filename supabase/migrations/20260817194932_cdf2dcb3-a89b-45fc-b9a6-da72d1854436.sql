-- Requirement 13: donations to Help a Pet Now campaigns, and redirection of
-- donations on estimate campaigns that expire without verification.

CREATE TABLE public.campaign_donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.help_now_campaigns(id) ON DELETE CASCADE,
  donor_user_id UUID,
  donor_name TEXT,
  donor_email TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  -- redirection state (Requirement 13)
  redirection_id UUID,
  redirected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  redirected_at TIMESTAMPTZ,
  donor_notification_status TEXT NOT NULL DEFAULT 'none',
  donor_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_donations_campaign ON public.campaign_donations(campaign_id);
CREATE INDEX idx_campaign_donations_donor ON public.campaign_donations(donor_user_id);

GRANT SELECT ON public.campaign_donations TO authenticated;
GRANT ALL ON public.campaign_donations TO service_role;
ALTER TABLE public.campaign_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can view their own donations"
  ON public.campaign_donations FOR SELECT TO authenticated
  USING (donor_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_campaign_donations_updated_at
  BEFORE UPDATE ON public.campaign_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A batch of donations held on an expired, unverified campaign, awaiting an
-- admin decision before the money moves to verified cases.
CREATE TABLE public.campaign_redirections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_campaign_id UUID NOT NULL REFERENCES public.help_now_campaigns(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  unallocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT 'estimate_expired_without_verification',
  released_at TIMESTAMPTZ,
  released_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_campaign_redirections_open_source
  ON public.campaign_redirections(source_campaign_id)
  WHERE status = 'pending';

GRANT SELECT ON public.campaign_redirections TO authenticated;
GRANT ALL ON public.campaign_redirections TO service_role;
ALTER TABLE public.campaign_redirections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view redirections"
  ON public.campaign_redirections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_campaign_redirections_updated_at
  BEFORE UPDATE ON public.campaign_redirections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaign_redirection_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  redirection_id UUID NOT NULL REFERENCES public.campaign_redirections(id) ON DELETE CASCADE,
  receiving_campaign_id UUID NOT NULL REFERENCES public.help_now_campaigns(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redirection_allocations_redirection
  ON public.campaign_redirection_allocations(redirection_id);

GRANT SELECT ON public.campaign_redirection_allocations TO authenticated;
GRANT ALL ON public.campaign_redirection_allocations TO service_role;
ALTER TABLE public.campaign_redirection_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view redirection allocations"
  ON public.campaign_redirection_allocations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Donors view allocations of their redirected donations"
  ON public.campaign_redirection_allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaign_donations d
    WHERE d.redirection_id = campaign_redirection_allocations.redirection_id
      AND d.donor_user_id = auth.uid()
  ));

ALTER TABLE public.campaign_donations
  ADD CONSTRAINT campaign_donations_redirection_fk
  FOREIGN KEY (redirection_id) REFERENCES public.campaign_redirections(id) ON DELETE SET NULL;