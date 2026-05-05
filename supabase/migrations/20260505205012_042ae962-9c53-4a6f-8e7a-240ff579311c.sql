
-- Enums
CREATE TYPE public.vet_ticket_status AS ENUM (
  'submitted', 'under_review', 'approved', 'rejected',
  'funded', 'card_issued', 'settled', 'expired', 'cancelled'
);

CREATE TYPE public.bnpl_obligation_status AS ENUM (
  'pending', 'active', 'paid_off', 'defaulted', 'cancelled'
);

CREATE TYPE public.vet_payout_method AS ENUM (
  'manual_ach', 'issued_card', 'direct_charge'
);

CREATE TYPE public.vet_payout_status AS ENUM (
  'pending', 'sent', 'completed', 'failed', 'reversed'
);

-- vet_tickets
CREATE TABLE public.vet_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  membership_id UUID,
  vet_profile_id UUID,
  clinic_name TEXT NOT NULL,
  clinic_merchant_id TEXT,
  estimate_amount NUMERIC NOT NULL CHECK (estimate_amount > 0),
  estimate_url TEXT,
  attestation_url TEXT,
  notes TEXT,
  status public.vet_ticket_status NOT NULL DEFAULT 'submitted',
  coverage_breakdown JSONB,
  approved_amount NUMERIC,
  member_remainder_paid BOOLEAN NOT NULL DEFAULT false,
  member_remainder_stripe_session_id TEXT,
  card_id TEXT,
  authorized_until TIMESTAMPTZ,
  admin_notes TEXT,
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vet_tickets_owner ON public.vet_tickets(owner_id);
CREATE INDEX idx_vet_tickets_pet ON public.vet_tickets(pet_id);
CREATE INDEX idx_vet_tickets_status ON public.vet_tickets(status);

ALTER TABLE public.vet_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own tickets" ON public.vet_tickets
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners create own tickets" ON public.vet_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners cancel own tickets" ON public.vet_tickets
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id AND status IN ('submitted','under_review'))
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins manage all tickets" ON public.vet_tickets
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_vet_tickets_updated
  BEFORE UPDATE ON public.vet_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ticket_dp_consumptions
CREATE TABLE public.ticket_dp_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  accrual_id UUID NOT NULL,
  amount_consumed NUMERIC NOT NULL CHECK (amount_consumed > 0),
  released BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tdc_ticket ON public.ticket_dp_consumptions(ticket_id);
CREATE INDEX idx_tdc_accrual ON public.ticket_dp_consumptions(accrual_id);

ALTER TABLE public.ticket_dp_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own consumptions" ON public.ticket_dp_consumptions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.vet_tickets t
            WHERE t.id = ticket_dp_consumptions.ticket_id AND t.owner_id = auth.uid())
  );
CREATE POLICY "Admins view all consumptions" ON public.ticket_dp_consumptions
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- bnpl_obligations
CREATE TABLE public.bnpl_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  original_amount NUMERIC NOT NULL CHECK (original_amount >= 0),
  outstanding_amount NUMERIC NOT NULL CHECK (outstanding_amount >= 0),
  status public.bnpl_obligation_status NOT NULL DEFAULT 'pending',
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bnpl_pet ON public.bnpl_obligations(pet_id);
CREATE INDEX idx_bnpl_owner ON public.bnpl_obligations(owner_id);
CREATE INDEX idx_bnpl_status ON public.bnpl_obligations(status);

ALTER TABLE public.bnpl_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own bnpl" ON public.bnpl_obligations
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins manage bnpl" ON public.bnpl_obligations
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_bnpl_updated
  BEFORE UPDATE ON public.bnpl_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- vet_payouts
CREATE TABLE public.vet_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method public.vet_payout_method NOT NULL DEFAULT 'manual_ach',
  status public.vet_payout_status NOT NULL DEFAULT 'pending',
  external_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vp_ticket ON public.vet_payouts(ticket_id);

ALTER TABLE public.vet_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own payouts" ON public.vet_payouts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.vet_tickets t
            WHERE t.id = vet_payouts.ticket_id AND t.owner_id = auth.uid())
  );
CREATE POLICY "Admins manage payouts" ON public.vet_payouts
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_vp_updated
  BEFORE UPDATE ON public.vet_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- get_plan_year_window
CREATE OR REPLACE FUNCTION public.get_plan_year_window(_membership_id UUID)
RETURNS TABLE(year_start TIMESTAMPTZ, year_end TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _started TIMESTAMPTZ;
  _years_elapsed INT;
BEGIN
  SELECT COALESCE(started_at, created_at) INTO _started
  FROM public.memberships WHERE id = _membership_id;
  IF _started IS NULL THEN RETURN; END IF;
  _years_elapsed := FLOOR(EXTRACT(EPOCH FROM (now() - _started)) / (365.25 * 86400));
  year_start := _started + (_years_elapsed || ' years')::INTERVAL;
  year_end := _started + ((_years_elapsed + 1) || ' years')::INTERVAL;
  RETURN NEXT;
END;
$$;

-- consume_dp_for_ticket  (FIFO oldest-first)
CREATE OR REPLACE FUNCTION public.consume_dp_for_ticket(
  _ticket_id UUID, _user_id UUID, _amount NUMERIC, _window_months INT
)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _remaining NUMERIC := _amount;
  _consumed_total NUMERIC := 0;
  _take NUMERIC;
  r RECORD;
  _cutoff DATE;
BEGIN
  IF _window_months IS NULL THEN
    _cutoff := DATE '1900-01-01';
  ELSE
    _cutoff := (CURRENT_DATE - (_window_months || ' months')::INTERVAL)::DATE;
  END IF;

  FOR r IN
    SELECT id, remaining_amount FROM public.direct_pay_accruals
    WHERE user_id = _user_id AND expired = false
      AND remaining_amount > 0 AND accrual_month >= _cutoff
    ORDER BY accrual_month ASC, created_at ASC FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(r.remaining_amount, _remaining);
    UPDATE public.direct_pay_accruals
      SET remaining_amount = remaining_amount - _take
      WHERE id = r.id;
    INSERT INTO public.ticket_dp_consumptions(ticket_id, accrual_id, amount_consumed)
      VALUES (_ticket_id, r.id, _take);
    _remaining := _remaining - _take;
    _consumed_total := _consumed_total + _take;
  END LOOP;
  RETURN _consumed_total;
END;
$$;

-- release_ticket_allocations
CREATE OR REPLACE FUNCTION public.release_ticket_allocations(_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, accrual_id, amount_consumed FROM public.ticket_dp_consumptions
    WHERE ticket_id = _ticket_id AND released = false FOR UPDATE
  LOOP
    UPDATE public.direct_pay_accruals
      SET remaining_amount = remaining_amount + r.amount_consumed
      WHERE id = r.accrual_id AND expired = false;
    UPDATE public.ticket_dp_consumptions SET released = true WHERE id = r.id;
  END LOOP;

  UPDATE public.bnpl_obligations
    SET status = 'cancelled', outstanding_amount = 0
    WHERE ticket_id = _ticket_id AND status IN ('pending','active');
END;
$$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('vet-tickets','vet-tickets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners upload own ticket files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vet-tickets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners read own ticket files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vet-tickets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete own ticket files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vet-tickets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all ticket files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vet-tickets' AND has_role(auth.uid(),'admin'));
