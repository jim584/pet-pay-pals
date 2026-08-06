-- 1) Backfill pet binding for legacy memberships
DO $$
DECLARE r RECORD; _pet uuid;
BEGIN
  FOR r IN SELECT id, user_id FROM public.memberships WHERE pet_id IS NULL LOOP
    SELECT p.id INTO _pet FROM public.pets p WHERE p.owner_id = r.user_id ORDER BY p.created_at ASC LIMIT 1;
    IF _pet IS NULL THEN
      INSERT INTO public.pets (owner_id, name, species, notes)
      VALUES (r.user_id, 'Unnamed Pet', 'dog', 'Auto-created to bind a legacy membership to a pet. Please rename and complete this profile.')
      RETURNING id INTO _pet;
    END IF;
    UPDATE public.memberships SET pet_id = _pet WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.memberships ALTER COLUMN pet_id SET NOT NULL;

-- 2) Community reserve balance derived from recorded flows
CREATE OR REPLACE VIEW public.v_community_reserve_balance
WITH (security_invoker = on) AS
SELECT
  COALESCE((SELECT SUM(community_reserve_portion) FROM public.dp_expiry_ledger), 0)
  - COALESCE((SELECT SUM(amount) FROM public.ledger_entries WHERE bucket = 'community_reserve' AND entry_type IN ('payout','finalize')), 0)
  + COALESCE((SELECT SUM(amount) FROM public.ledger_entries WHERE bucket = 'community_reserve' AND entry_type = 'reversal'), 0)
  AS balance;

GRANT SELECT ON public.v_community_reserve_balance TO authenticated, anon, service_role;

-- 3) Member Reserve consumption must be bound to the pet's own membership
CREATE OR REPLACE FUNCTION public.consume_reserve_for_ticket(_ticket_id uuid, _user_id uuid, _amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _remaining NUMERIC := _amount;
  _consumed NUMERIC := 0;
  _take NUMERIC;
  r RECORD;
  _pet uuid;
BEGIN
  SELECT pet_id INTO _pet FROM public.vet_tickets WHERE id = _ticket_id;
  FOR r IN
    SELECT a.id, a.remaining_amount, a.membership_id
    FROM public.member_reserve_accruals a
    LEFT JOIN public.memberships m ON m.id = a.membership_id
    WHERE a.user_id = _user_id AND a.remaining_amount > 0
      AND (_pet IS NULL OR m.pet_id IS NULL OR m.pet_id = _pet)
    ORDER BY a.accrual_month ASC, a.created_at ASC
    FOR UPDATE OF a
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(r.remaining_amount, _remaining);
    UPDATE public.member_reserve_accruals
      SET remaining_amount = remaining_amount - _take WHERE id = r.id;
    INSERT INTO public.member_reserve_consumptions(ticket_id, accrual_id, amount_consumed)
      VALUES (_ticket_id, r.id, _take);
    PERFORM public.post_ledger_entry(
      _user_id, 'member_reserve', 'hold', _take,
      'reserve_hold:' || _ticket_id || ':' || r.id,
      _pet, r.membership_id, _ticket_id, NULL, r.id, NULL, 'Member Reserve hold for vet ticket'
    );
    _remaining := _remaining - _take;
    _consumed := _consumed + _take;
  END LOOP;
  RETURN _consumed;
END;
$function$;

-- 4) BNPL repayments post to the ledger
CREATE OR REPLACE FUNCTION public.apply_bnpl_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _orig numeric; _paid_total numeric; _new_outstanding numeric; _o RECORD;
BEGIN
  SELECT * INTO _o FROM public.bnpl_obligations WHERE id = NEW.obligation_id FOR UPDATE;
  _orig := _o.original_amount;
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

  PERFORM public.post_ledger_entry(
    _o.owner_id, 'bnpl', 'finalize', NEW.amount,
    'bnpl_payment_row:' || NEW.id,
    _o.pet_id, NULL, _o.ticket_id, _o.id, NULL, NEW.external_ref,
    'Payment plan repayment'
  );

  PERFORM public.allocate_bnpl_payment_to_installments(NEW.obligation_id);
  RETURN NEW;
END;
$function$;