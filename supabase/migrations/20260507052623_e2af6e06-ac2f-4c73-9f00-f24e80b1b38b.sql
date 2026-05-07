-- Plan-driven BNPL settings
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS bnpl_multiplier numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS max_concurrent_obligations integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS bnpl_default_installments integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS bnpl_default_interval_days integer NOT NULL DEFAULT 30;

-- Obligation extensions
ALTER TABLE public.bnpl_obligations
  ADD COLUMN IF NOT EXISTS installment_count integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS installment_interval_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS last_payment_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Installments table
CREATE TABLE IF NOT EXISTS public.bnpl_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES public.bnpl_obligations(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | due | paid | missed
  paid_at timestamptz,
  last_reminded_at timestamptz,
  reminder_stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obligation_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_bnpl_inst_obligation ON public.bnpl_installments(obligation_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_inst_due_date ON public.bnpl_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_bnpl_inst_status ON public.bnpl_installments(status);

ALTER TABLE public.bnpl_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own installments" ON public.bnpl_installments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bnpl_obligations o
      WHERE o.id = bnpl_installments.obligation_id AND o.owner_id = auth.uid())
  );

CREATE POLICY "Admins manage installments" ON public.bnpl_installments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Generate installments
CREATE OR REPLACE FUNCTION public.generate_bnpl_installments(_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _o RECORD;
  _per numeric;
  _last numeric;
  _i int;
  _due date;
  _start date;
  _allocated numeric := 0;
BEGIN
  SELECT * INTO _o FROM public.bnpl_obligations WHERE id = _obligation_id;
  IF _o IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.bnpl_installments WHERE obligation_id = _obligation_id) THEN
    RETURN;
  END IF;
  IF _o.original_amount <= 0 OR _o.installment_count <= 0 THEN RETURN; END IF;

  _per := ROUND(_o.original_amount / _o.installment_count, 2);
  _start := CURRENT_DATE;
  FOR _i IN 1.._o.installment_count LOOP
    _due := _start + (_i * _o.installment_interval_days || ' days')::interval;
    IF _i = _o.installment_count THEN
      _last := ROUND(_o.original_amount - _allocated, 2);
      INSERT INTO public.bnpl_installments(obligation_id, seq, due_date, amount)
        VALUES (_obligation_id, _i, _due, _last);
    ELSE
      INSERT INTO public.bnpl_installments(obligation_id, seq, due_date, amount)
        VALUES (_obligation_id, _i, _due, _per);
      _allocated := _allocated + _per;
    END IF;
  END LOOP;

  UPDATE public.bnpl_obligations
    SET next_due_date = (SELECT MIN(due_date) FROM public.bnpl_installments WHERE obligation_id = _obligation_id AND status <> 'paid')
    WHERE id = _obligation_id;
END;
$$;

-- Trigger to generate installments on obligation insert
CREATE OR REPLACE FUNCTION public.bnpl_obligation_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_bnpl_installments(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bnpl_obligation_after_insert ON public.bnpl_obligations;
CREATE TRIGGER trg_bnpl_obligation_after_insert
  AFTER INSERT ON public.bnpl_obligations
  FOR EACH ROW EXECUTE FUNCTION public.bnpl_obligation_after_insert();

-- Allocate payments across installments FIFO
CREATE OR REPLACE FUNCTION public.allocate_bnpl_payment_to_installments(_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _orig numeric;
  _paid_total numeric;
  _to_allocate numeric;
  r RECORD;
  _take numeric;
BEGIN
  SELECT original_amount INTO _orig FROM public.bnpl_obligations WHERE id = _obligation_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0) INTO _paid_total FROM public.bnpl_payments WHERE obligation_id = _obligation_id;

  -- reset all installment paid_amount, then re-allocate (idempotent)
  UPDATE public.bnpl_installments
    SET paid_amount = 0,
        status = CASE WHEN due_date < CURRENT_DATE THEN 'due' ELSE 'scheduled' END,
        paid_at = NULL
    WHERE obligation_id = _obligation_id;

  _to_allocate := _paid_total;
  FOR r IN
    SELECT id, amount FROM public.bnpl_installments
    WHERE obligation_id = _obligation_id ORDER BY seq ASC FOR UPDATE
  LOOP
    EXIT WHEN _to_allocate <= 0;
    _take := LEAST(r.amount, _to_allocate);
    UPDATE public.bnpl_installments
      SET paid_amount = _take,
          status = CASE WHEN _take >= r.amount THEN 'paid' ELSE status END,
          paid_at = CASE WHEN _take >= r.amount THEN now() ELSE NULL END
      WHERE id = r.id;
    _to_allocate := _to_allocate - _take;
  END LOOP;

  UPDATE public.bnpl_obligations
    SET next_due_date = (
      SELECT MIN(due_date) FROM public.bnpl_installments
      WHERE obligation_id = _obligation_id AND status <> 'paid'
    )
    WHERE id = _obligation_id;
END;
$$;

-- Update existing apply/revert triggers to also re-allocate installments
CREATE OR REPLACE FUNCTION public.apply_bnpl_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _orig numeric; _paid_total numeric; _new_outstanding numeric;
BEGIN
  SELECT original_amount INTO _orig FROM public.bnpl_obligations WHERE id = NEW.obligation_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0) INTO _paid_total FROM public.bnpl_payments WHERE obligation_id = NEW.obligation_id;
  _new_outstanding := GREATEST(_orig - _paid_total, 0);

  UPDATE public.bnpl_obligations
    SET outstanding_amount = _new_outstanding,
        status = CASE
          WHEN _new_outstanding <= 0 THEN 'paid_off'::bnpl_obligation_status
          WHEN status = 'pending' THEN 'active'::bnpl_obligation_status
          ELSE status
        END,
        updated_at = now()
    WHERE id = NEW.obligation_id;

  PERFORM public.allocate_bnpl_payment_to_installments(NEW.obligation_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_bnpl_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _orig numeric; _paid_total numeric; _new_outstanding numeric; _cur bnpl_obligation_status;
BEGIN
  SELECT original_amount, status INTO _orig, _cur FROM public.bnpl_obligations WHERE id = OLD.obligation_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0) INTO _paid_total FROM public.bnpl_payments WHERE obligation_id = OLD.obligation_id;
  _new_outstanding := GREATEST(_orig - _paid_total, 0);

  UPDATE public.bnpl_obligations
    SET outstanding_amount = _new_outstanding,
        status = CASE
          WHEN _new_outstanding <= 0 THEN 'paid_off'::bnpl_obligation_status
          WHEN _cur = 'paid_off' AND _new_outstanding > 0 THEN 'active'::bnpl_obligation_status
          ELSE _cur
        END,
        updated_at = now()
    WHERE id = OLD.obligation_id;

  PERFORM public.allocate_bnpl_payment_to_installments(OLD.obligation_id);
  RETURN OLD;
END;
$$;

-- Mark obligation defaulted
CREATE OR REPLACE FUNCTION public.mark_obligation_default(_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.bnpl_obligations
    SET status = 'defaulted'::bnpl_obligation_status,
        default_at = COALESCE(default_at, now()),
        updated_at = now()
    WHERE id = _obligation_id AND status IN ('pending','active');
END;
$$;

-- Backfill installments for any existing obligations without schedule
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.bnpl_obligations
    WHERE NOT EXISTS (SELECT 1 FROM public.bnpl_installments i WHERE i.obligation_id = bnpl_obligations.id)
  LOOP
    PERFORM public.generate_bnpl_installments(r.id);
  END LOOP;
END $$;