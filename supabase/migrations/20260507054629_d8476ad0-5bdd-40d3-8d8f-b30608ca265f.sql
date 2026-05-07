
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_payment_method_id text;

ALTER TABLE public.bnpl_obligations
  ADD COLUMN IF NOT EXISTS auto_pay_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.bnpl_installments
  ADD COLUMN IF NOT EXISTS auto_charge_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_charge_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_auto_charge_error text;

ALTER TABLE public.bnpl_processor_runs
  ADD COLUMN IF NOT EXISTS auto_charges_attempted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_charges_succeeded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_charges_failed integer NOT NULL DEFAULT 0;

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS bnpl_default_penalty numeric NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS bnpl_min_multiplier numeric NOT NULL DEFAULT 0.0;

-- Allow owners to update auto_pay_enabled on their own obligations
DROP POLICY IF EXISTS "Owners toggle autopay" ON public.bnpl_obligations;
CREATE POLICY "Owners toggle autopay"
  ON public.bnpl_obligations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
