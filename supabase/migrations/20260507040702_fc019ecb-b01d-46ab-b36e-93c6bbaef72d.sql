
-- Enums
DO $$ BEGIN
  CREATE TYPE public.referrer_type AS ENUM ('vet','shelter','influencer','partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings (singleton)
CREATE TABLE IF NOT EXISTS public.referral_program_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intro_rate numeric NOT NULL DEFAULT 0.05,
  intro_months int NOT NULL DEFAULT 6,
  ongoing_rate numeric NOT NULL DEFAULT 0.02,
  hold_days int NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.referral_program_settings (intro_rate, intro_months, ongoing_rate, hold_days)
SELECT 0.05, 6, 0.02, 30
WHERE NOT EXISTS (SELECT 1 FROM public.referral_program_settings);

ALTER TABLE public.referral_program_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON public.referral_program_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.referral_program_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Referrers
CREATE TABLE IF NOT EXISTS public.referrers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  type public.referrer_type NOT NULL,
  display_name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  fear_free_certified boolean NOT NULL DEFAULT false,
  payout_email text,
  payout_method text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrers_user_id ON public.referrers(user_id);
CREATE INDEX IF NOT EXISTS idx_referrers_code_lower ON public.referrers(lower(code));

CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text LANGUAGE sql AS $$
  SELECT upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8))
$$;

CREATE OR REPLACE FUNCTION public.referrers_set_defaults()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    LOOP
      NEW.code := public.gen_referral_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referrers WHERE code = NEW.code);
    END LOOP;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_referrers_defaults ON public.referrers;
CREATE TRIGGER trg_referrers_defaults BEFORE INSERT OR UPDATE ON public.referrers
  FOR EACH ROW EXECUTE FUNCTION public.referrers_set_defaults();

ALTER TABLE public.referrers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referrers" ON public.referrers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Referrers view own" ON public.referrers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.referrers(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE,
  membership_id uuid,
  code_used text NOT NULL,
  status text NOT NULL DEFAULT 'pending_signup',
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON public.referrals(referred_user_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Referred user views own referral" ON public.referrals FOR SELECT TO authenticated
  USING (referred_user_id = auth.uid());
CREATE POLICY "Referrer views own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.referrers r WHERE r.id = referrals.referrer_id AND r.user_id = auth.uid()));
CREATE POLICY "Referred user creates own referral" ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = referred_user_id
    AND NOT EXISTS (SELECT 1 FROM public.referrals existing WHERE existing.referred_user_id = auth.uid())
  );

-- Referrer payouts
CREATE TABLE IF NOT EXISTS public.referrer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.referrers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  external_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_referrer_payouts_referrer ON public.referrer_payouts(referrer_id);

ALTER TABLE public.referrer_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referrer payouts" ON public.referrer_payouts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Referrers view own payouts" ON public.referrer_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.referrers r WHERE r.id = referrer_payouts.referrer_id AND r.user_id = auth.uid()));

-- Bounties
CREATE TABLE IF NOT EXISTS public.referral_bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.referrers(id) ON DELETE CASCADE,
  payment_history_id uuid,
  membership_id uuid,
  period text NOT NULL,
  rate numeric NOT NULL,
  gross_membership_amount numeric NOT NULL,
  bounty_amount numeric NOT NULL,
  hold_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payout_id uuid REFERENCES public.referrer_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bounties_referrer ON public.referral_bounties(referrer_id);
CREATE INDEX IF NOT EXISTS idx_bounties_referral ON public.referral_bounties(referral_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON public.referral_bounties(status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bounty_per_payment ON public.referral_bounties(payment_history_id) WHERE payment_history_id IS NOT NULL;

ALTER TABLE public.referral_bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bounties" ON public.referral_bounties FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Referrers view own bounties" ON public.referral_bounties FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.referrers r WHERE r.id = referral_bounties.referrer_id AND r.user_id = auth.uid()));

-- Public lookup (anon-callable) returns minimal info needed at signup
CREATE OR REPLACE FUNCTION public.resolve_referral_code(_code text)
RETURNS TABLE(referrer_id uuid, display_name text, type public.referrer_type)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, display_name, type FROM public.referrers
  WHERE lower(code) = lower(_code) AND is_active = true
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated;
