CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  membership_id UUID NULL,
  kind TEXT NOT NULL DEFAULT 'membership_invoice',
  status TEXT NOT NULL DEFAULT 'paid',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  description TEXT NULL,
  stripe_invoice_id TEXT NULL,
  stripe_charge_id TEXT NULL,
  stripe_payment_intent_id TEXT NULL,
  stripe_subscription_id TEXT NULL,
  hosted_invoice_url TEXT NULL,
  invoice_pdf TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_history_invoice_unique
  ON public.payment_history (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX payment_history_user_idx ON public.payment_history (user_id, occurred_at DESC);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payment history"
  ON public.payment_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all payment history"
  ON public.payment_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));