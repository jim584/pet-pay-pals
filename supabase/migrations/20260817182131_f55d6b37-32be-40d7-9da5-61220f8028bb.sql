-- Future-proof the veterinarian profile and pet models for Vetted affiliate tracking.
-- These columns are intentionally unused by current code; they exist only so the
-- future affiliate feature can be added without a data migration or backfill.

-- 1. Reserve affiliate fields on the vet profile.
ALTER TABLE public.vet_profiles
  ADD COLUMN IF NOT EXISTS vetted_affiliate_id text,
  ADD COLUMN IF NOT EXISTS vetted_affiliate_link text;

COMMENT ON COLUMN public.vet_profiles.vetted_affiliate_id IS 'Reserved for future Vetted affiliate tracking. Do not use yet.';
COMMENT ON COLUMN public.vet_profiles.vetted_affiliate_link IS 'Reserved for future Vetted affiliate tracking. Do not use yet.';

-- 2. Add a direct pet -> vet profile link for "veterinarian of record" attribution.
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS vet_profile_id uuid REFERENCES public.vet_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pets_vet_profile ON public.pets (vet_profile_id);

COMMENT ON COLUMN public.pets.vet_profile_id IS 'Direct veterinarian-of-record link. Reserved for future Vetted affiliate tracking.';
