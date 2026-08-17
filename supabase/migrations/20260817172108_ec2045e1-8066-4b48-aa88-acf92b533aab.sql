ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS vet_of_record_license_id uuid REFERENCES public.vet_license_records(id) ON DELETE SET NULL;

ALTER TABLE public.vet_license_records
  ADD COLUMN IF NOT EXISTS vet_profile_id uuid REFERENCES public.vet_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vlr_vet_profile ON public.vet_license_records (vet_profile_id);

REVOKE EXECUTE ON FUNCTION public.search_vet_licenses(text, text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_vet_licenses(text, text, integer) TO authenticated, service_role;