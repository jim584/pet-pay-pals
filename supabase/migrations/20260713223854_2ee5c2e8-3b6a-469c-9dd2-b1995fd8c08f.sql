
-- Enum for verification status
DO $$ BEGIN
  CREATE TYPE public.vet_verification_status AS ENUM ('pending','verified','unverified','pending_review','manual_override');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend vet_profiles
ALTER TABLE public.vet_profiles
  ADD COLUMN IF NOT EXISTS license_state TEXT,
  ADD COLUMN IF NOT EXISTS license_full_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_status public.vet_verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_source TEXT,
  ADD COLUMN IF NOT EXISTS verification_source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_reason TEXT,
  ADD COLUMN IF NOT EXISTS verification_raw JSONB,
  ADD COLUMN IF NOT EXISTS fear_free_verification_status public.vet_verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fear_free_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fear_free_source TEXT,
  ADD COLUMN IF NOT EXISTS fear_free_reason TEXT,
  ADD COLUMN IF NOT EXISTS fear_free_raw JSONB;

-- Attempts audit table
CREATE TABLE IF NOT EXISTS public.vet_verification_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_profile_id UUID NOT NULL REFERENCES public.vet_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('license','fear_free')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  http_status INT,
  source TEXT,
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_verif_attempts_profile ON public.vet_verification_attempts(vet_profile_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_vet_verif_attempts_kind_status ON public.vet_verification_attempts(kind, status);

GRANT SELECT ON public.vet_verification_attempts TO authenticated;
GRANT ALL ON public.vet_verification_attempts TO service_role;

ALTER TABLE public.vet_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vets can view own verification attempts"
  ON public.vet_verification_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vet_profiles vp
      WHERE vp.id = vet_verification_attempts.vet_profile_id
        AND vp.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger: whenever key license fields change, reset status to pending
CREATE OR REPLACE FUNCTION public.reset_vet_verification_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.license_number IS DISTINCT FROM OLD.license_number
     OR NEW.license_state IS DISTINCT FROM OLD.license_state
     OR NEW.license_full_legal_name IS DISTINCT FROM OLD.license_full_legal_name
  THEN
    NEW.verification_status := 'pending';
    NEW.verification_checked_at := NULL;
    NEW.verification_reason := NULL;
  END IF;

  IF NEW.fear_free_cert_number IS DISTINCT FROM OLD.fear_free_cert_number THEN
    NEW.fear_free_verification_status := 'pending';
    NEW.fear_free_checked_at := NULL;
    NEW.fear_free_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_vet_verification_on_change ON public.vet_profiles;
CREATE TRIGGER trg_reset_vet_verification_on_change
BEFORE UPDATE ON public.vet_profiles
FOR EACH ROW EXECUTE FUNCTION public.reset_vet_verification_on_change();
