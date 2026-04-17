-- Add stripe_customer_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Membership plans (static reference)
CREATE TABLE public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL UNIQUE,
  tier_label TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  species TEXT NOT NULL CHECK (species IN ('dog','cat')),
  membership_fee NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL,
  direct_pay_portion NUMERIC NOT NULL,
  reserve_portion NUMERIC NOT NULL,
  admin_portion NUMERIC NOT NULL,
  plan_cap NUMERIC,
  dp_window_months INTEGER,
  max_dp_amount NUMERIC,
  annual_price NUMERIC NOT NULL,
  fear_free_member_charge NUMERIC NOT NULL,
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual TEXT,
  stripe_platform_price_id_monthly TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.membership_plans
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage plans" ON public.membership_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Memberships (active subscriptions)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.membership_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','cancelled','paused')),
  billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month','year')),
  is_fear_free_member BOOLEAN NOT NULL DEFAULT false,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  started_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_stripe_sub ON public.memberships(stripe_subscription_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own memberships" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all memberships" ON public.memberships
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Direct Pay accruals
CREATE TABLE public.direct_pay_accruals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  accrual_month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL,
  expires_at TIMESTAMPTZ,
  expired BOOLEAN NOT NULL DEFAULT false,
  expired_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dp_accruals_user ON public.direct_pay_accruals(user_id);
CREATE INDEX idx_dp_accruals_expires ON public.direct_pay_accruals(expires_at) WHERE expired = false;

ALTER TABLE public.direct_pay_accruals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own accruals" ON public.direct_pay_accruals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all accruals" ON public.direct_pay_accruals
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- DP expiry ledger
CREATE TABLE public.dp_expiry_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accrual_id UUID NOT NULL REFERENCES public.direct_pay_accruals(id) ON DELETE CASCADE,
  expired_amount NUMERIC NOT NULL,
  community_reserve_portion NUMERIC NOT NULL,
  help_now_portion NUMERIC NOT NULL,
  admin_portion NUMERIC NOT NULL,
  help_now_case_id UUID,
  reason TEXT NOT NULL DEFAULT 'window_expired',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dp_expiry_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ledger" ON public.dp_expiry_ledger
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Community reserve singleton balance
CREATE TABLE public.community_reserve (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.community_reserve (balance) VALUES (0);

ALTER TABLE public.community_reserve ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view reserve" ON public.community_reserve
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed plan data (Bronze/Silver/Gold/Platinum × Dog/Cat)
INSERT INTO public.membership_plans
  (plan_code, tier_label, tier, species, membership_fee, platform_fee, direct_pay_portion, reserve_portion, admin_portion, plan_cap, dp_window_months, max_dp_amount, annual_price, fear_free_member_charge)
VALUES
  ('bronze_dog','Together™ 10k','bronze','dog',60,10,42,6,12,10000,12,504,780,57.00),
  ('bronze_cat','Together™ 10k','bronze','cat',40,10,28,4,8,10000,12,336,540,38.00),
  ('silver_dog','Together™ 15k','silver','dog',80,10,56,8,16,15000,24,1344,1020,76.00),
  ('silver_cat','Together™ 15k','silver','cat',60,10,42,6,12,15000,24,1008,780,57.00),
  ('gold_dog','Together™ 20k','gold','dog',100,10,70,10,20,20000,36,2520,1260,95.00),
  ('gold_cat','Together™ 20k','gold','cat',80,10,56,8,16,20000,36,2016,1020,76.00),
  ('platinum_dog','Together™ Unlimited','platinum','dog',120,10,84,12,24,NULL,NULL,NULL,1500,114.00),
  ('platinum_cat','Together™ Unlimited','platinum','cat',90,10,63,9,18,NULL,NULL,NULL,1140,85.50);