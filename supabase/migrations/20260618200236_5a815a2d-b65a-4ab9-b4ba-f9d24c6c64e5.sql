-- 1. BNPL pause columns
ALTER TABLE public.bnpl_obligations
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_reason text;

CREATE INDEX IF NOT EXISTS idx_bnpl_obligations_owner_paused
  ON public.bnpl_obligations(owner_id, paused);

-- 2. Sync function: pause/unpause an owner's open BNPL obligations based on membership status
CREATE OR REPLACE FUNCTION public.sync_bnpl_paused_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_active boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND status IN ('active','past_due')
  ) INTO _has_active;

  IF _has_active THEN
    UPDATE public.bnpl_obligations
      SET paused = false, paused_at = NULL, paused_reason = NULL, updated_at = now()
      WHERE owner_id = _user_id
        AND paused = true
        AND status IN ('pending','active');
  ELSE
    UPDATE public.bnpl_obligations
      SET paused = true,
          paused_at = COALESCE(paused_at, now()),
          paused_reason = COALESCE(paused_reason, 'membership_inactive'),
          updated_at = now()
      WHERE owner_id = _user_id
        AND paused = false
        AND status IN ('pending','active');
  END IF;
END;
$$;

-- 3. Trigger on memberships.status changes
CREATE OR REPLACE FUNCTION public.trg_memberships_sync_bnpl()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_bnpl_paused_for_user(NEW.user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      PERFORM public.sync_bnpl_paused_for_user(NEW.user_id);
      IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        PERFORM public.sync_bnpl_paused_for_user(OLD.user_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memberships_sync_bnpl_paused ON public.memberships;
CREATE TRIGGER memberships_sync_bnpl_paused
  AFTER INSERT OR UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.trg_memberships_sync_bnpl();

-- 4. Auto-approve threshold setting
ALTER TABLE public.referral_program_settings
  ADD COLUMN IF NOT EXISTS auto_approve_ticket_threshold numeric NOT NULL DEFAULT 500;

-- 5. Backfill: pause obligations for any owners whose membership is currently not active/past_due
UPDATE public.bnpl_obligations o
  SET paused = true,
      paused_at = now(),
      paused_reason = 'membership_inactive',
      updated_at = now()
  WHERE o.paused = false
    AND o.status IN ('pending','active')
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = o.owner_id AND m.status IN ('active','past_due')
    );