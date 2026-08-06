CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pet_id uuid,
  membership_id uuid,
  bucket text NOT NULL CHECK (bucket IN ('direct_pay','member_reserve','community_reserve','wallet','bnpl')),
  entry_type text NOT NULL CHECK (entry_type IN ('accrual','hold','hold_release','finalize','reversal','expiry','payout')),
  amount numeric NOT NULL CHECK (amount >= 0),
  ticket_id uuid,
  obligation_id uuid,
  accrual_id uuid,
  parent_entry_id uuid REFERENCES public.ledger_entries(id),
  external_ref text,
  idempotency_key text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ledger_entries_idempotency_key_uidx ON public.ledger_entries (idempotency_key);
CREATE INDEX ledger_entries_user_bucket_idx ON public.ledger_entries (user_id, bucket);
CREATE INDEX ledger_entries_pet_bucket_idx ON public.ledger_entries (pet_id, bucket);
CREATE INDEX ledger_entries_ticket_idx ON public.ledger_entries (ticket_id);
CREATE INDEX ledger_entries_obligation_idx ON public.ledger_entries (obligation_id);

GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ledger entries"
ON public.ledger_entries FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.ledger_entries_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only; post a reversing entry instead';
END;
$$;

CREATE TRIGGER trg_ledger_entries_no_update
BEFORE UPDATE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_append_only();

CREATE TRIGGER trg_ledger_entries_no_delete
BEFORE DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_append_only();

-- Central posting helper. Idempotent: repeated keys are ignored.
CREATE OR REPLACE FUNCTION public.post_ledger_entry(
  _user_id uuid,
  _bucket text,
  _entry_type text,
  _amount numeric,
  _idempotency_key text,
  _pet_id uuid DEFAULT NULL,
  _membership_id uuid DEFAULT NULL,
  _ticket_id uuid DEFAULT NULL,
  _obligation_id uuid DEFAULT NULL,
  _accrual_id uuid DEFAULT NULL,
  _external_ref text DEFAULT NULL,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, pet_id, membership_id, bucket, entry_type, amount,
    ticket_id, obligation_id, accrual_id, external_ref, idempotency_key, description, metadata
  ) VALUES (
    _user_id, _pet_id, _membership_id, _bucket, _entry_type, ROUND(_amount, 2),
    _ticket_id, _obligation_id, _accrual_id, _external_ref, _idempotency_key, _description, COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_ledger_entry(uuid, text, text, numeric, text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb) TO service_role;

-- Signed deltas: accrual/hold_release/reversal add, expiry/payout subtract.
-- held  = hold - hold_release - finalize
-- spent = finalize - reversal
CREATE OR REPLACE VIEW public.v_ledger_balances
WITH (security_invoker = on) AS
SELECT
  user_id,
  pet_id,
  bucket,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'accrual'), 0) AS accrued,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'expiry'), 0) AS expired,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'payout'), 0) AS paid_out,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'hold'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'hold_release'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'finalize'), 0) AS held,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'finalize'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'reversal'), 0) AS spent,
  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'accrual'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'expiry'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'payout'), 0)
    - (COALESCE(SUM(amount) FILTER (WHERE entry_type = 'hold'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'hold_release'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'finalize'), 0))
    - (COALESCE(SUM(amount) FILTER (WHERE entry_type = 'finalize'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'reversal'), 0)) AS available
FROM public.ledger_entries
GROUP BY user_id, pet_id, bucket;

GRANT SELECT ON public.v_ledger_balances TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_pet_dp_balance
WITH (security_invoker = on) AS
SELECT user_id, pet_id, accrued, expired, held, spent, available
FROM public.v_ledger_balances WHERE bucket = 'direct_pay';

CREATE OR REPLACE VIEW public.v_member_reserve_balance
WITH (security_invoker = on) AS
SELECT user_id, pet_id, accrued, held, spent, available
FROM public.v_ledger_balances WHERE bucket = 'member_reserve';

GRANT SELECT ON public.v_pet_dp_balance TO authenticated, service_role;
GRANT SELECT ON public.v_member_reserve_balance TO authenticated, service_role;

-- Backfill Direct Pay history into the ledger.
INSERT INTO public.ledger_entries (user_id, pet_id, membership_id, bucket, entry_type, amount, accrual_id, external_ref, idempotency_key, description, created_at)
SELECT a.user_id,
       (SELECT m.pet_id FROM public.memberships m WHERE m.id = a.membership_id),
       a.membership_id, 'direct_pay', 'accrual', a.amount, a.id, a.stripe_invoice_id,
       'backfill:dp_accrual:' || a.id, 'Direct Pay accrual (backfill)', a.created_at
FROM public.direct_pay_accruals a
WHERE a.amount > 0;

INSERT INTO public.ledger_entries (user_id, pet_id, bucket, entry_type, amount, ticket_id, accrual_id, idempotency_key, description, created_at)
SELECT t.owner_id,
       t.pet_id,
       'direct_pay', 'hold', c.amount_consumed, c.ticket_id, c.accrual_id,
       'backfill:dp_hold:' || c.id, 'Direct Pay hold (backfill)', c.created_at
FROM public.ticket_dp_consumptions c
JOIN public.vet_tickets t ON t.id = c.ticket_id
WHERE c.released = false AND c.amount_consumed > 0;

INSERT INTO public.ledger_entries (user_id, pet_id, bucket, entry_type, amount, ticket_id, accrual_id, idempotency_key, description, created_at)
SELECT t.owner_id, t.pet_id, 'direct_pay', 'finalize', c.amount_consumed, c.ticket_id, c.accrual_id,
       'backfill:dp_finalize:' || c.id, 'Direct Pay spend (backfill)', c.created_at
FROM public.ticket_dp_consumptions c
JOIN public.vet_tickets t ON t.id = c.ticket_id
WHERE c.released = false AND c.amount_consumed > 0
  AND t.status IN ('settled','funded','card_issued');

INSERT INTO public.ledger_entries (user_id, pet_id, membership_id, bucket, entry_type, amount, accrual_id, idempotency_key, description, created_at)
SELECT a.user_id,
       (SELECT m.pet_id FROM public.memberships m WHERE m.id = a.membership_id),
       a.membership_id, 'direct_pay', 'expiry', a.amount - a.remaining_amount, a.id,
       'backfill:dp_expiry:' || a.id, 'Direct Pay expiry (backfill)', COALESCE(a.expired_at, a.created_at)
FROM public.direct_pay_accruals a
WHERE a.expired = true AND (a.amount - a.remaining_amount) > 0;

INSERT INTO public.ledger_entries (user_id, membership_id, bucket, entry_type, amount, accrual_id, external_ref, idempotency_key, description, created_at)
SELECT r.user_id, r.membership_id, 'member_reserve', 'accrual', r.amount, r.id, r.stripe_invoice_id,
       'backfill:reserve_accrual:' || r.id, 'Member Reserve accrual (backfill)', r.created_at
FROM public.member_reserve_accruals r
WHERE r.amount > 0;

INSERT INTO public.ledger_entries (user_id, pet_id, bucket, entry_type, amount, ticket_id, accrual_id, idempotency_key, description, created_at)
SELECT t.owner_id, t.pet_id, 'member_reserve', 'hold', c.amount_consumed, c.ticket_id, c.accrual_id,
       'backfill:reserve_hold:' || c.id, 'Member Reserve hold (backfill)', c.created_at
FROM public.member_reserve_consumptions c
JOIN public.vet_tickets t ON t.id = c.ticket_id
WHERE c.released = false AND c.amount_consumed > 0;