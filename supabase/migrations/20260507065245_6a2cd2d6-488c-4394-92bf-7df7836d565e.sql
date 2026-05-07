-- Member reserve accruals (per-paid-month 10% allocation)
CREATE TABLE public.member_reserve_accruals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  accrual_month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mra_user ON public.member_reserve_accruals(user_id, accrual_month);
CREATE INDEX idx_mra_invoice ON public.member_reserve_accruals(stripe_invoice_id);

ALTER TABLE public.member_reserve_accruals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reserve accruals" ON public.member_reserve_accruals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all reserve accruals" ON public.member_reserve_accruals
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Ticket-level draws against reserve
CREATE TABLE public.member_reserve_consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  accrual_id UUID NOT NULL REFERENCES public.member_reserve_accruals(id) ON DELETE CASCADE,
  amount_consumed NUMERIC NOT NULL,
  released BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mrc_ticket ON public.member_reserve_consumptions(ticket_id);

ALTER TABLE public.member_reserve_consumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own reserve consumptions" ON public.member_reserve_consumptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vet_tickets t WHERE t.id = member_reserve_consumptions.ticket_id AND t.owner_id = auth.uid())
  );
CREATE POLICY "Admins view all reserve consumptions" ON public.member_reserve_consumptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Eligibility tracking on memberships
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS reserve_eligible_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS continuous_paid_months INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_paid_month DATE;

-- Consume reserve oldest-first
CREATE OR REPLACE FUNCTION public.consume_reserve_for_ticket(_ticket_id UUID, _user_id UUID, _amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining NUMERIC := _amount;
  _consumed NUMERIC := 0;
  _take NUMERIC;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, remaining_amount FROM public.member_reserve_accruals
    WHERE user_id = _user_id AND remaining_amount > 0
    ORDER BY accrual_month ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(r.remaining_amount, _remaining);
    UPDATE public.member_reserve_accruals
      SET remaining_amount = remaining_amount - _take WHERE id = r.id;
    INSERT INTO public.member_reserve_consumptions(ticket_id, accrual_id, amount_consumed)
      VALUES (_ticket_id, r.id, _take);
    _remaining := _remaining - _take;
    _consumed := _consumed + _take;
  END LOOP;
  RETURN _consumed;
END;
$$;

-- Release reserve allocations (refund on settle/cancel)
CREATE OR REPLACE FUNCTION public.release_reserve_for_ticket(_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, accrual_id, amount_consumed FROM public.member_reserve_consumptions
    WHERE ticket_id = _ticket_id AND released = false FOR UPDATE
  LOOP
    UPDATE public.member_reserve_accruals
      SET remaining_amount = remaining_amount + r.amount_consumed
      WHERE id = r.accrual_id;
    UPDATE public.member_reserve_consumptions SET released = true WHERE id = r.id;
  END LOOP;
END;
$$;