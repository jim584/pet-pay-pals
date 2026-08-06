REVOKE EXECUTE ON FUNCTION public.post_ledger_entry(uuid, text, text, numeric, text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- 1. Bind memberships to a pet.
UPDATE public.memberships m
SET pet_id = (
  SELECT p.id FROM public.pets p WHERE p.owner_id = m.user_id ORDER BY p.created_at ASC LIMIT 1
)
WHERE m.pet_id IS NULL;

CREATE OR REPLACE FUNCTION public.require_membership_pet()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pet_id IS NULL THEN
    RAISE EXCEPTION 'A membership must be linked to a specific pet';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_require_membership_pet
BEFORE INSERT ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.require_membership_pet();

-- 2. Direct Pay consumption: pet-scoped + ledger holds.
CREATE OR REPLACE FUNCTION public.consume_dp_for_ticket(_ticket_id uuid, _user_id uuid, _amount numeric, _window_months integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining NUMERIC := _amount;
  _consumed_total NUMERIC := 0;
  _take NUMERIC;
  r RECORD;
  _cutoff DATE;
  _pet_id uuid;
BEGIN
  SELECT pet_id INTO _pet_id FROM public.vet_tickets WHERE id = _ticket_id;

  IF _window_months IS NULL THEN
    _cutoff := DATE '1900-01-01';
  ELSE
    _cutoff := (CURRENT_DATE - (_window_months || ' months')::INTERVAL)::DATE;
  END IF;

  FOR r IN
    SELECT a.id, a.remaining_amount, a.membership_id
    FROM public.direct_pay_accruals a
    LEFT JOIN public.memberships m ON m.id = a.membership_id
    WHERE a.user_id = _user_id AND a.expired = false
      AND a.remaining_amount > 0 AND a.accrual_month >= _cutoff
      AND (m.pet_id IS NULL OR _pet_id IS NULL OR m.pet_id = _pet_id)
    ORDER BY a.accrual_month ASC, a.created_at ASC FOR UPDATE OF a
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(r.remaining_amount, _remaining);
    UPDATE public.direct_pay_accruals
      SET remaining_amount = remaining_amount - _take
      WHERE id = r.id;
    INSERT INTO public.ticket_dp_consumptions(ticket_id, accrual_id, amount_consumed)
      VALUES (_ticket_id, r.id, _take);
    PERFORM public.post_ledger_entry(
      _user_id, 'direct_pay', 'hold', _take,
      'dp_hold:' || _ticket_id || ':' || r.id,
      _pet_id, r.membership_id, _ticket_id, NULL, r.id, NULL, 'Direct Pay hold for vet ticket'
    );
    _remaining := _remaining - _take;
    _consumed_total := _consumed_total + _take;
  END LOOP;
  RETURN _consumed_total;
END;
$$;

-- 3. Release DP + cancel BNPL: ledger hold_release.
CREATE OR REPLACE FUNCTION public.release_ticket_allocations(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; _owner uuid; _pet uuid;
BEGIN
  SELECT owner_id, pet_id INTO _owner, _pet FROM public.vet_tickets WHERE id = _ticket_id;

  FOR r IN
    SELECT id, accrual_id, amount_consumed FROM public.ticket_dp_consumptions
    WHERE ticket_id = _ticket_id AND released = false FOR UPDATE
  LOOP
    UPDATE public.direct_pay_accruals
      SET remaining_amount = remaining_amount + r.amount_consumed
      WHERE id = r.accrual_id AND expired = false;
    UPDATE public.ticket_dp_consumptions SET released = true WHERE id = r.id;
    PERFORM public.post_ledger_entry(
      _owner, 'direct_pay', 'hold_release', r.amount_consumed,
      'dp_release:' || r.id, _pet, NULL, _ticket_id, NULL, r.accrual_id, NULL,
      'Direct Pay hold released'
    );
  END LOOP;

  UPDATE public.bnpl_obligations
    SET status = 'cancelled', outstanding_amount = 0
    WHERE ticket_id = _ticket_id AND status IN ('pending','active');
END;
$$;

-- 4. Member Reserve consumption + release with ledger entries.
CREATE OR REPLACE FUNCTION public.consume_reserve_for_ticket(_ticket_id uuid, _user_id uuid, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining NUMERIC := _amount;
  _consumed NUMERIC := 0;
  _take NUMERIC;
  r RECORD;
  _pet uuid;
BEGIN
  SELECT pet_id INTO _pet FROM public.vet_tickets WHERE id = _ticket_id;
  FOR r IN
    SELECT id, remaining_amount, membership_id FROM public.member_reserve_accruals
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
$$;

CREATE OR REPLACE FUNCTION public.release_reserve_for_ticket(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; _owner uuid; _pet uuid;
BEGIN
  SELECT owner_id, pet_id INTO _owner, _pet FROM public.vet_tickets WHERE id = _ticket_id;
  FOR r IN
    SELECT id, accrual_id, amount_consumed FROM public.member_reserve_consumptions
    WHERE ticket_id = _ticket_id AND released = false FOR UPDATE
  LOOP
    UPDATE public.member_reserve_accruals
      SET remaining_amount = remaining_amount + r.amount_consumed
      WHERE id = r.accrual_id;
    UPDATE public.member_reserve_consumptions SET released = true WHERE id = r.id;
    PERFORM public.post_ledger_entry(
      _owner, 'member_reserve', 'hold_release', r.amount_consumed,
      'reserve_release:' || r.id, _pet, NULL, _ticket_id, NULL, r.accrual_id, NULL,
      'Member Reserve hold released'
    );
  END LOOP;
END;
$$;

-- 5. Settlement: finalize spend, release the unused part, valid payout statuses.
CREATE OR REPLACE FUNCTION public.mark_ticket_settled(_ticket_id uuid, _settled_amount numeric, _authorization_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approved numeric;
  _owner uuid;
  _pet uuid;
  _delta numeric;
  _refund numeric;
  _take numeric;
  r RECORD;
BEGIN
  SELECT approved_amount, owner_id, pet_id
    INTO _approved, _owner, _pet
    FROM public.vet_tickets WHERE id = _ticket_id FOR UPDATE;
  IF _approved IS NULL THEN RETURN; END IF;

  _delta := GREATEST(_approved - _settled_amount, 0);

  UPDATE public.vet_tickets
    SET status = 'settled',
        last_authorization_id = _authorization_id,
        updated_at = now()
    WHERE id = _ticket_id;

  INSERT INTO public.vet_payouts(ticket_id, amount, method, status, external_ref)
    VALUES (_ticket_id, _settled_amount, 'issued_card', 'settled', _authorization_id)
    ON CONFLICT DO NOTHING;
  UPDATE public.vet_payouts
    SET status = 'settled', amount = _settled_amount, external_ref = _authorization_id, updated_at = now()
    WHERE ticket_id = _ticket_id AND status NOT IN ('settled','reversed','cancelled');

  -- Direct Pay: refund the unused portion first, finalize what was actually used.
  IF _delta > 0 THEN
    _refund := _delta;
    FOR r IN
      SELECT c.id, c.accrual_id, c.amount_consumed
        FROM public.ticket_dp_consumptions c
        WHERE c.ticket_id = _ticket_id AND c.released = false
        ORDER BY c.created_at DESC FOR UPDATE
    LOOP
      EXIT WHEN _refund <= 0;
      _take := LEAST(r.amount_consumed, _refund);
      UPDATE public.direct_pay_accruals
        SET remaining_amount = remaining_amount + _take
        WHERE id = r.accrual_id AND expired = false;
      IF _take = r.amount_consumed THEN
        UPDATE public.ticket_dp_consumptions SET released = true WHERE id = r.id;
      ELSE
        UPDATE public.ticket_dp_consumptions
          SET amount_consumed = amount_consumed - _take WHERE id = r.id;
      END IF;
      PERFORM public.post_ledger_entry(
        _owner, 'direct_pay', 'hold_release', _take,
        'dp_settle_release:' || _ticket_id || ':' || r.id, _pet, NULL, _ticket_id, NULL, r.accrual_id,
        _authorization_id, 'Unused Direct Pay released at settlement'
      );
      _refund := _refund - _take;
    END LOOP;
  END IF;

  -- Finalize remaining holds for this ticket (DP and Reserve).
  FOR r IN
    SELECT c.id, c.accrual_id, c.amount_consumed FROM public.ticket_dp_consumptions c
    WHERE c.ticket_id = _ticket_id AND c.released = false
  LOOP
    PERFORM public.post_ledger_entry(
      _owner, 'direct_pay', 'finalize', r.amount_consumed,
      'dp_finalize:' || _ticket_id || ':' || r.id, _pet, NULL, _ticket_id, NULL, r.accrual_id,
      _authorization_id, 'Direct Pay spent at settlement'
    );
  END LOOP;

  FOR r IN
    SELECT c.id, c.accrual_id, c.amount_consumed FROM public.member_reserve_consumptions c
    WHERE c.ticket_id = _ticket_id AND c.released = false
  LOOP
    PERFORM public.post_ledger_entry(
      _owner, 'member_reserve', 'finalize', r.amount_consumed,
      'reserve_finalize:' || _ticket_id || ':' || r.id, _pet, NULL, _ticket_id, NULL, r.accrual_id,
      _authorization_id, 'Member Reserve spent at settlement'
    );
  END LOOP;
END;
$$;

-- 6. Refund / dispute reversal of a settled ticket.
CREATE OR REPLACE FUNCTION public.reverse_ticket_settlement(_ticket_id uuid, _amount numeric, _reason text, _external_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid; _pet uuid; _remaining numeric := _amount; _take numeric; r RECORD;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  SELECT owner_id, pet_id INTO _owner, _pet FROM public.vet_tickets WHERE id = _ticket_id;
  IF _owner IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT c.id, c.accrual_id, c.amount_consumed FROM public.ticket_dp_consumptions c
    WHERE c.ticket_id = _ticket_id AND c.released = false ORDER BY c.created_at DESC FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(r.amount_consumed, _remaining);
    UPDATE public.direct_pay_accruals
      SET remaining_amount = remaining_amount + _take
      WHERE id = r.accrual_id AND expired = false;
    PERFORM public.post_ledger_entry(
      _owner, 'direct_pay', 'reversal', _take,
      'dp_reversal:' || _ticket_id || ':' || r.id || ':' || COALESCE(_external_ref, _reason),
      _pet, NULL, _ticket_id, NULL, r.accrual_id, _external_ref,
      COALESCE(_reason, 'Reversal')
    );
    _remaining := _remaining - _take;
  END LOOP;

  UPDATE public.vet_payouts
    SET status = 'reversed', updated_at = now(), notes = COALESCE(_reason, notes)
    WHERE ticket_id = _ticket_id AND status = 'settled';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverse_ticket_settlement(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_ticket_settlement(uuid, numeric, text, text) TO service_role;