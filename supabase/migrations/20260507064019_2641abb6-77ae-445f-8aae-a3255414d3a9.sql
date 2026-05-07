
-- 1. Vet credential fields
ALTER TABLE public.vet_profiles
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_state text,
  ADD COLUMN IF NOT EXISTS license_document_url text,
  ADD COLUMN IF NOT EXISTS is_license_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_verified_by uuid,
  ADD COLUMN IF NOT EXISTS fear_free_certified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fear_free_cert_number text,
  ADD COLUMN IF NOT EXISTS fear_free_cert_url text,
  ADD COLUMN IF NOT EXISTS fear_free_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS fear_free_verified_by uuid;

-- 2. Pet -> Vet of Record
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS vet_of_record_id uuid REFERENCES public.vet_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vet_of_record_set_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pets_vet_of_record_id ON public.pets(vet_of_record_id);

-- 3. Trigger: prevent non-admins from writing verification fields on vet_profiles
CREATE OR REPLACE FUNCTION public.guard_vet_profile_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  -- service_role / definer-context calls (no auth.uid()) bypass the guard.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF _is_admin THEN
    -- Admins are allowed to set verification fields. Stamp who/when on flips.
    IF TG_OP = 'UPDATE' THEN
      IF NEW.is_license_verified IS DISTINCT FROM OLD.is_license_verified AND NEW.is_license_verified = true THEN
        NEW.license_verified_at := now();
        NEW.license_verified_by := auth.uid();
      END IF;
      IF NEW.fear_free_certified IS DISTINCT FROM OLD.fear_free_certified AND NEW.fear_free_certified = true THEN
        NEW.fear_free_verified_at := now();
        NEW.fear_free_verified_by := auth.uid();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admin: revert any verification field writes back to OLD (or default false on insert).
  IF TG_OP = 'INSERT' THEN
    NEW.is_license_verified := false;
    NEW.license_verified_at := NULL;
    NEW.license_verified_by := NULL;
    NEW.fear_free_certified := false;
    NEW.fear_free_verified_at := NULL;
    NEW.fear_free_verified_by := NULL;
  ELSE
    NEW.is_license_verified := OLD.is_license_verified;
    NEW.license_verified_at := OLD.license_verified_at;
    NEW.license_verified_by := OLD.license_verified_by;
    NEW.fear_free_certified := OLD.fear_free_certified;
    NEW.fear_free_verified_at := OLD.fear_free_verified_at;
    NEW.fear_free_verified_by := OLD.fear_free_verified_by;
    -- also lock is_approved against self-approval
    NEW.is_approved := OLD.is_approved;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vet_profile_verification ON public.vet_profiles;
CREATE TRIGGER trg_guard_vet_profile_verification
  BEFORE INSERT OR UPDATE ON public.vet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vet_profile_verification_fields();

-- 4. Private storage bucket for credential files
INSERT INTO storage.buckets (id, name, public)
VALUES ('vet-credentials', 'vet-credentials', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: vets manage their own folder, admins read all.
DROP POLICY IF EXISTS "Vets upload own credentials" ON storage.objects;
CREATE POLICY "Vets upload own credentials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vet-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Vets update own credentials" ON storage.objects;
CREATE POLICY "Vets update own credentials"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vet-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Vets read own credentials" ON storage.objects;
CREATE POLICY "Vets read own credentials"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vet-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Vets delete own credentials" ON storage.objects;
CREATE POLICY "Vets delete own credentials"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vet-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins read all credentials" ON storage.objects;
CREATE POLICY "Admins read all credentials"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vet-credentials'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
