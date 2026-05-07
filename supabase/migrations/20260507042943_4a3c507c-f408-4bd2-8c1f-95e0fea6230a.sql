CREATE OR REPLACE FUNCTION public.record_milestone_contribution(_milestone_id uuid, _amount numeric, _source text DEFAULT 'donation'::text, _payment_history_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _m RECORD;
  _new_raised numeric;
  _hold_days int;
BEGIN
  -- Idempotency: if a contribution with this payment_history_id already exists, skip silently.
  IF _payment_history_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.shelter_milestone_contributions WHERE payment_history_id = _payment_history_id) THEN
      RETURN;
    END IF;
  END IF;

  SELECT * INTO _m FROM public.shelter_referral_milestones WHERE id = _milestone_id FOR UPDATE;
  IF _m IS NULL THEN RAISE EXCEPTION 'Milestone not found'; END IF;

  INSERT INTO public.shelter_milestone_contributions(milestone_id, payment_history_id, amount, source)
  VALUES (_milestone_id, _payment_history_id, _amount, _source);

  _new_raised := _m.raised_amount + _amount;

  UPDATE public.shelter_referral_milestones
    SET raised_amount = _new_raised,
        status = CASE WHEN _new_raised >= goal_amount AND status = 'open' THEN 'completed' ELSE status END,
        completed_at = CASE WHEN _new_raised >= goal_amount AND status = 'open' THEN now() ELSE completed_at END
    WHERE id = _milestone_id;

  IF _m.status = 'open' AND _new_raised >= _m.goal_amount THEN
    SELECT hold_days INTO _hold_days FROM public.referral_program_settings LIMIT 1;
    _hold_days := COALESCE(_hold_days, 30);

    INSERT INTO public.referral_bounties(
      referral_id, referrer_id, payment_history_id, membership_id,
      period, rate, gross_membership_amount, bounty_amount, hold_until, status
    )
    SELECT
      (SELECT id FROM public.referrals WHERE referrer_id = _m.referrer_id LIMIT 1),
      _m.referrer_id, _payment_history_id, NULL,
      'milestone', 0, _m.goal_amount, _m.payout_amount,
      now() + (_hold_days || ' days')::interval, 'pending'
    WHERE EXISTS (SELECT 1 FROM public.referrers WHERE id = _m.referrer_id);
  END IF;
END $function$;