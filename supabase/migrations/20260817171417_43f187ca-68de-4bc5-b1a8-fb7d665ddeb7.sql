CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. License records -----------------------------------------------------
CREATE TABLE public.vet_license_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  license_number text NOT NULL,
  full_name text NOT NULL,
  normalized_name text NOT NULL,
  first_name text,
  last_name text,
  license_status text NOT NULL,
  license_status_raw text,
  license_type text NOT NULL,
  license_type_raw text,
  address_line1 text,
  address_line2 text,
  city text,
  address_state text,
  postal_code text,
  county text,
  phone text,
  issue_date date,
  expiration_date date,
  source_authority text,
  source_url text,
  source_synced_at timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  deactivated_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vet_license_records_state_license_key UNIQUE (state, license_number)
);

GRANT SELECT ON public.vet_license_records TO authenticated;
GRANT ALL ON public.vet_license_records TO service_role;
ALTER TABLE public.vet_license_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can search license records"
ON public.vet_license_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage license records"
ON public.vet_license_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_vlr_state_active ON public.vet_license_records (state, is_active);
CREATE INDEX idx_vlr_name_trgm ON public.vet_license_records USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_vlr_license_number ON public.vet_license_records (license_number);
CREATE INDEX idx_vlr_city ON public.vet_license_records (city);

CREATE TRIGGER update_vet_license_records_updated_at
BEFORE UPDATE ON public.vet_license_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Source registry -----------------------------------------------------
CREATE TABLE public.vet_license_sources (
  state_code text PRIMARY KEY,
  state_name text NOT NULL,
  authority text NOT NULL,
  import_method text NOT NULL DEFAULT 'manual_upload',
  source_url text,
  file_format text,
  refresh_cadence_days integer NOT NULL DEFAULT 7,
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  is_full_snapshot boolean NOT NULL DEFAULT true,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  record_count integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vet_license_sources_method_chk CHECK (import_method IN ('api','bulk_file','manual_upload','none_yet')),
  CONSTRAINT vet_license_sources_format_chk CHECK (file_format IS NULL OR file_format IN ('csv','tsv','xlsx','json','fixed_width'))
);

GRANT SELECT ON public.vet_license_sources TO authenticated;
GRANT ALL ON public.vet_license_sources TO service_role;
ALTER TABLE public.vet_license_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read license sources"
ON public.vet_license_sources FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage license sources"
ON public.vet_license_sources FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_vet_license_sources_updated_at
BEFORE UPDATE ON public.vet_license_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Import runs ---------------------------------------------------------
CREATE TABLE public.vet_license_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL REFERENCES public.vet_license_sources(state_code) ON DELETE CASCADE,
  trigger_source text NOT NULL DEFAULT 'manual',
  triggered_by uuid,
  import_method text NOT NULL,
  file_path text,
  status text NOT NULL DEFAULT 'running',
  rows_read integer NOT NULL DEFAULT 0,
  rows_kept integer NOT NULL DEFAULT 0,
  rows_filtered_status integer NOT NULL DEFAULT 0,
  rows_filtered_type integer NOT NULL DEFAULT 0,
  rows_invalid integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_deactivated integer NOT NULL DEFAULT 0,
  error_message text,
  error_samples jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vlir_status_chk CHECK (status IN ('running','success','failed','partial'))
);

GRANT SELECT ON public.vet_license_import_runs TO authenticated;
GRANT ALL ON public.vet_license_import_runs TO service_role;
ALTER TABLE public.vet_license_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read license import runs"
ON public.vet_license_import_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_vlir_state_started ON public.vet_license_import_runs (state_code, started_at DESC);

-- 4. Search helper (name / license / city typeahead) ---------------------
CREATE OR REPLACE FUNCTION public.search_vet_licenses(_q text, _state text DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS SETOF public.vet_license_records
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.vet_license_records r
  WHERE r.is_active
    AND (_state IS NULL OR r.state = upper(_state))
    AND (
      _q IS NULL OR length(trim(_q)) = 0
      OR r.normalized_name ILIKE '%' || lower(trim(_q)) || '%'
      OR r.license_number ILIKE trim(_q) || '%'
      OR r.city ILIKE trim(_q) || '%'
    )
  ORDER BY r.full_name
  LIMIT LEAST(COALESCE(_limit, 20), 100)
$$;

-- 5. Storage policies for uploaded source files --------------------------
CREATE POLICY "Admins upload license import files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vet-license-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read license import files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vet-license-imports' AND public.has_role(auth.uid(), 'admin'));