CREATE TABLE public.bnpl_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obligation_id UUID NOT NULL REFERENCES public.bnpl_obligations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  method TEXT NOT NULL DEFAULT 'manual',
  external_ref TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bnpl_payments_obligation ON public.bnpl_payments(obligation_id);
CREATE INDEX idx_bnpl_payments_paid_at ON public.bnpl_payments(paid_at DESC);

ALTER TABLE public.bnpl_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bnpl payments"
  ON public.bnpl_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own bnpl payments"
  ON public.bnpl_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bnpl_obligations o
    WHERE o.id = bnpl_payments.obligation_id AND o.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.apply_bnpl_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _orig NUMERIC; _paid_total NUMERIC; _new_outstanding NUMERIC;
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bnpl_payment_apply
  AFTER INSERT ON public.bnpl_payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_bnpl_payment();

CREATE OR REPLACE FUNCTION public.revert_bnpl_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _orig NUMERIC; _paid_total NUMERIC; _new_outstanding NUMERIC; _cur_status bnpl_obligation_status;
BEGIN
  SELECT original_amount, status INTO _orig, _cur_status FROM public.bnpl_obligations WHERE id = OLD.obligation_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0) INTO _paid_total FROM public.bnpl_payments WHERE obligation_id = OLD.obligation_id;
  _new_outstanding := GREATEST(_orig - _paid_total, 0);

  UPDATE public.bnpl_obligations
    SET outstanding_amount = _new_outstanding,
        status = CASE
          WHEN _new_outstanding <= 0 THEN 'paid_off'::bnpl_obligation_status
          WHEN _cur_status = 'paid_off' AND _new_outstanding > 0 THEN 'active'::bnpl_obligation_status
          ELSE _cur_status
        END,
        updated_at = now()
    WHERE id = OLD.obligation_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_bnpl_payment_revert
  AFTER DELETE ON public.bnpl_payments
  FOR EACH ROW EXECUTE FUNCTION public.revert_bnpl_payment();