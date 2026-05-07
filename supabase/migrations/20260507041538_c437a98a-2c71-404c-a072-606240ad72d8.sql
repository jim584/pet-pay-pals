
-- Stripe Connect columns
ALTER TABLE public.referrers
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.referrer_payouts
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

-- Shelter milestones
CREATE TABLE IF NOT EXISTS public.shelter_referral_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.referrers(id) ON DELETE CASCADE,
  adoption_listing_id uuid,
  pet_name text NOT NULL,
  goal_amount numeric NOT NULL,
  raised_amount numeric NOT NULL DEFAULT 0,
  payout_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shelter_referral_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage milestones" ON public.shelter_referral_milestones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shelter referrers view own milestones" ON public.shelter_referral_milestones
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.referrers r WHERE r.id = referrer_id AND r.user_id = auth.uid()));

CREATE POLICY "Anyone can view open milestones" ON public.shelter_referral_milestones
  FOR SELECT TO anon, authenticated
  USING (status IN ('open','completed'));

CREATE TABLE IF NOT EXISTS public.shelter_milestone_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.shelter_referral_milestones(id) ON DELETE CASCADE,
  payment_history_id uuid,
  amount numeric NOT NULL,
  source text NOT NULL DEFAULT 'donation',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shelter_milestone_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contributions" ON public.shelter_milestone_contributions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shelter referrers view own contributions" ON public.shelter_milestone_contributions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shelter_referral_milestones m
    JOIN public.referrers r ON r.id = m.referrer_id
    WHERE m.id = milestone_id AND r.user_id = auth.uid()
  ));

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON public.shelter_referral_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: record contribution and create bounty when goal reached
CREATE OR REPLACE FUNCTION public.record_milestone_contribution(
  _milestone_id uuid,
  _amount numeric,
  _source text DEFAULT 'donation',
  _payment_history_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _m RECORD;
  _new_raised numeric;
  _hold_days int;
  _referral_id uuid;
BEGIN
  SELECT * INTO _m FROM public.shelter_referral_milestones WHERE id = _milestone_id FOR UPDATE;
  IF _m IS NULL THEN RAISE EXCEPTION 'Milestone not found'; END IF;

  INSERT INTO public.shelter_milestone_contributions(milestone_id, payment_history_id, amount, source)
  VALUES (_milestone_id, _payment_history_id, _amount, _source);

  _new_raised := _m.raised_amount + _amount;

  UPDATE public.shelter_referral_milestones
    SET raised_amount = _new_raised,
        status = CASE WHEN _new_raised >= goal_amount AND status = 'open' THEN 'completed' ELSE status END,
        completed_at = CASE WHEN _new_raised >= goal_amount AND status = 'open' THEN now() ELSE completed_at END
    WHERE id = _milestone_id;

  -- If newly completed, create a bounty (no referral row required for shelter milestone payouts)
  IF _m.status = 'open' AND _new_raised >= _m.goal_amount THEN
    SELECT hold_days INTO _hold_days FROM public.referral_program_settings LIMIT 1;
    _hold_days := COALESCE(_hold_days, 30);

    -- Create a synthetic referral row tying milestone payout to referrer (optional, kept null)
    INSERT INTO public.referral_bounties(
      referral_id, referrer_id, payment_history_id, membership_id,
      period, rate, gross_membership_amount, bounty_amount, hold_until, status
    )
    SELECT
      (SELECT id FROM public.referrals WHERE referrer_id = _m.referrer_id LIMIT 1),
      _m.referrer_id, _payment_history_id, NULL,
      'milestone', 0, _m.goal_amount, _m.payout_amount,
      now() + (_hold_days || ' days')::interval, 'pending'
    WHERE EXISTS (SELECT 1 FROM public.referrers WHERE id = _m.referrer_id);
  END IF;
END $$;
