
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS requires_admin_approval boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.membership_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  changed_by uuid,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_status_changes_membership
  ON public.membership_status_changes(membership_id, created_at DESC);

ALTER TABLE public.membership_status_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view membership status changes" ON public.membership_status_changes;
CREATE POLICY "Admins view membership status changes"
  ON public.membership_status_changes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners view own membership status changes" ON public.membership_status_changes;
CREATE POLICY "Owners view own membership status changes"
  ON public.membership_status_changes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.id = membership_status_changes.membership_id
      AND m.user_id = auth.uid()
  ));

-- Allow admins to update memberships (status changes via UI)
DROP POLICY IF EXISTS "Admins manage memberships" ON public.memberships;
CREATE POLICY "Admins manage memberships"
  ON public.memberships FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow users to insert their own pending membership applications
DROP POLICY IF EXISTS "Users insert own membership requests" ON public.memberships;
CREATE POLICY "Users insert own membership requests"
  ON public.memberships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND requires_admin_approval = true);

-- Trigger: auto-log every membership status change to history
CREATE OR REPLACE FUNCTION public.log_membership_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _source text;
  _changer uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      _source := current_setting('app.status_source', true);
    EXCEPTION WHEN others THEN
      _source := NULL;
    END;
    IF _source IS NULL OR _source = '' THEN
      _source := 'system';
    END IF;

    BEGIN
      _changer := nullif(current_setting('app.status_changer', true), '')::uuid;
    EXCEPTION WHEN others THEN
      _changer := NULL;
    END;

    INSERT INTO public.membership_status_changes
      (membership_id, from_status, to_status, source, changed_by, reason, notes)
    VALUES
      (NEW.id, OLD.status, NEW.status, _source, _changer, NEW.rejection_reason, NEW.admin_notes);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_membership_status_change ON public.memberships;
CREATE TRIGGER trg_log_membership_status_change
  AFTER UPDATE OF status ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.log_membership_status_change();

-- Also log creation
CREATE OR REPLACE FUNCTION public.log_membership_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.membership_status_changes
    (membership_id, from_status, to_status, source, changed_by, notes)
  VALUES
    (NEW.id, NULL, NEW.status, 'system', NEW.user_id, 'Membership created');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_membership_create ON public.memberships;
CREATE TRIGGER trg_log_membership_create
  AFTER INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.log_membership_create();
