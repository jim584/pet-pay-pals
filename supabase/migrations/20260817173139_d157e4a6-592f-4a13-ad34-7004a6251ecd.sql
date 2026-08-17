DO $$ BEGIN
  CREATE TYPE public.vet_account_status AS ENUM ('pending_verification', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.vet_profiles
  ADD COLUMN IF NOT EXISTS account_status public.vet_account_status NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS merchant_id text,
  ADD COLUMN IF NOT EXISTS identity_photo_path text,
  ADD COLUMN IF NOT EXISTS identity_photo_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verified_by uuid,
  ADD COLUMN IF NOT EXISTS identity_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_rejection_reason text,
  ADD COLUMN IF NOT EXISTS license_db_match jsonb;

UPDATE public.vet_profiles
SET account_status = 'pending_verification', is_approved = false;

CREATE OR REPLACE FUNCTION public.is_verified_vet(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vet_profiles WHERE user_id = _user_id AND account_status = 'verified')
$$;

CREATE OR REPLACE FUNCTION public.is_verified_vet_profile(_vet_profile_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vet_profiles WHERE id = _vet_profile_id AND user_id = _user_id AND account_status = 'verified')
$$;

REVOKE EXECUTE ON FUNCTION public.is_verified_vet(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_verified_vet_profile(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_verified_vet(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_verified_vet_profile(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_vet_account_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF _is_admin THEN
    IF TG_OP = 'UPDATE' AND NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      NEW.identity_reviewed_at := now();
      NEW.identity_verified_by := auth.uid();
      NEW.is_approved := (NEW.account_status = 'verified');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.account_status := 'pending_verification';
    NEW.is_approved := false;
    NEW.identity_photo_path := NULL;
    NEW.identity_photo_captured_at := NULL;
    NEW.identity_verified_by := NULL;
    NEW.identity_reviewed_at := NULL;
    NEW.account_rejection_reason := NULL;
    NEW.license_db_match := NULL;
    NEW.merchant_id := NULL;
  ELSE
    NEW.account_status := OLD.account_status;
    NEW.is_approved := OLD.is_approved;
    NEW.identity_photo_path := OLD.identity_photo_path;
    NEW.identity_photo_captured_at := OLD.identity_photo_captured_at;
    NEW.identity_verified_by := OLD.identity_verified_by;
    NEW.identity_reviewed_at := OLD.identity_reviewed_at;
    NEW.account_rejection_reason := OLD.account_rejection_reason;
    NEW.license_db_match := OLD.license_db_match;
    NEW.merchant_id := OLD.merchant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vet_account_fields ON public.vet_profiles;
CREATE TRIGGER trg_guard_vet_account_fields
  BEFORE INSERT OR UPDATE ON public.vet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vet_account_fields();

DROP POLICY IF EXISTS "Vets can insert own services" ON public.services;
CREATE POLICY "Vets can insert own services"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (is_vet_profile_owner(vet_id, auth.uid()) AND public.is_verified_vet_profile(vet_id, auth.uid()));

DROP POLICY IF EXISTS "Vets can update own services" ON public.services;
CREATE POLICY "Vets can update own services"
  ON public.services FOR UPDATE TO authenticated
  USING (is_vet_profile_owner(vet_id, auth.uid()) AND public.is_verified_vet_profile(vet_id, auth.uid()))
  WITH CHECK (is_vet_profile_owner(vet_id, auth.uid()) AND public.is_verified_vet_profile(vet_id, auth.uid()));

DROP POLICY IF EXISTS "Vets can delete own services" ON public.services;
CREATE POLICY "Vets can delete own services"
  ON public.services FOR DELETE TO authenticated
  USING (is_vet_profile_owner(vet_id, auth.uid()) AND public.is_verified_vet_profile(vet_id, auth.uid()));

DROP POLICY IF EXISTS "Vets can update appointment status" ON public.appointments;
CREATE POLICY "Vets can update appointment status"
  ON public.appointments FOR UPDATE TO authenticated
  USING (is_vet_profile_owner(vet_id, auth.uid()) AND public.is_verified_vet_profile(vet_id, auth.uid()));

DROP POLICY IF EXISTS "Vets upload own identity photo" ON storage.objects;
CREATE POLICY "Vets upload own identity photo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vet-identity' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Vets read own identity photo" ON storage.objects;
CREATE POLICY "Vets read own identity photo"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vet-identity'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE TABLE IF NOT EXISTS public.vet_identity_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_profile_id uuid NOT NULL REFERENCES public.vet_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vet_identity_tokens TO authenticated;
GRANT ALL ON public.vet_identity_tokens TO service_role;
ALTER TABLE public.vet_identity_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vets view own identity tokens" ON public.vet_identity_tokens;
CREATE POLICY "Vets view own identity tokens"
  ON public.vet_identity_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_vit_hash ON public.vet_identity_tokens (token_hash);