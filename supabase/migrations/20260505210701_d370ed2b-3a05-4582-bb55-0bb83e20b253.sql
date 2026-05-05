
-- Profiles: cache Stripe Issuing cardholder
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_issuing_cardholder_id text;

-- issued_cards table
CREATE TABLE IF NOT EXISTS public.issued_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  stripe_card_id text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('virtual','physical')),
  last4 text,
  exp_month int,
  exp_year int,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','canceled')),
  shipping_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issued_cards_owner ON public.issued_cards(owner_id);
ALTER TABLE public.issued_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own issued cards" ON public.issued_cards
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins manage issued cards" ON public.issued_cards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_issued_cards_updated_at
  BEFORE UPDATE ON public.issued_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend vet_tickets
ALTER TABLE public.vet_tickets
  ADD COLUMN IF NOT EXISTS issued_card_id uuid REFERENCES public.issued_cards(id),
  ADD COLUMN IF NOT EXISTS merchant_lock_type text,
  ADD COLUMN IF NOT EXISTS last_authorization_id text;

-- issuing_authorizations log
CREATE TABLE IF NOT EXISTS public.issuing_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid,
  stripe_authorization_id text NOT NULL,
  stripe_card_id text,
  amount numeric,
  merchant_id text,
  merchant_category text,
  status text NOT NULL,
  decline_reason text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issuing_auth_ticket ON public.issuing_authorizations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_issuing_auth_stripe ON public.issuing_authorizations(stripe_authorization_id);
ALTER TABLE public.issuing_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own auths" ON public.issuing_authorizations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.vet_tickets t WHERE t.id = issuing_authorizations.ticket_id AND t.owner_id = auth.uid())
  );
CREATE POLICY "Admins manage auths" ON public.issuing_authorizations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- mark_ticket_settled: finalize ticket, create payout, refund unused DP
CREATE OR REPLACE FUNCTION public.mark_ticket_settled(
  _ticket_id uuid, _settled_amount numeric, _authorization_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _approved numeric;
  _delta numeric;
  _dp_used numeric;
  _refund numeric;
  r RECORD;
BEGIN
  SELECT approved_amount, COALESCE((coverage_breakdown->>'dp_use')::numeric,0)
    INTO _approved, _dp_used
    FROM public.vet_tickets WHERE id = _ticket_id FOR UPDATE;

  IF _approved IS NULL THEN RETURN; END IF;
  _delta := GREATEST(_approved - _settled_amount, 0);

  UPDATE public.vet_tickets
    SET status = 'settled',
        last_authorization_id = _authorization_id,
        updated_at = now()
    WHERE id = _ticket_id;

  -- record/upsert payout
  INSERT INTO public.vet_payouts(ticket_id, amount, method, status, external_ref)
    VALUES (_ticket_id, _settled_amount, 'issued_card', 'settled', _authorization_id)
    ON CONFLICT DO NOTHING;
  UPDATE public.vet_payouts
    SET status = 'settled', amount = _settled_amount, external_ref = _authorization_id, updated_at = now()
    WHERE ticket_id = _ticket_id AND method = 'manual_ach';

  -- refund unused DP portion proportionally (cap at dp_used)
  IF _delta > 0 AND _dp_used > 0 THEN
    _refund := LEAST(_delta, _dp_used);
    -- credit back oldest consumed accruals first
    FOR r IN
      SELECT c.id, c.accrual_id, c.amount_consumed
        FROM public.ticket_dp_consumptions c
        WHERE c.ticket_id = _ticket_id AND c.released = false
        ORDER BY c.created_at DESC FOR UPDATE
    LOOP
      EXIT WHEN _refund <= 0;
      DECLARE _take numeric := LEAST(r.amount_consumed, _refund);
      BEGIN
        UPDATE public.direct_pay_accruals
          SET remaining_amount = remaining_amount + _take
          WHERE id = r.accrual_id AND expired = false;
        IF _take = r.amount_consumed THEN
          UPDATE public.ticket_dp_consumptions SET released = true WHERE id = r.id;
        ELSE
          UPDATE public.ticket_dp_consumptions
            SET amount_consumed = amount_consumed - _take WHERE id = r.id;
        END IF;
        _refund := _refund - _take;
      END;
    END LOOP;
  END IF;
END;
$$;
