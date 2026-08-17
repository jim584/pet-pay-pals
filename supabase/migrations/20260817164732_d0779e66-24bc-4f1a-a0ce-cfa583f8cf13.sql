CREATE TABLE public.vet_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.vet_tickets(id) ON DELETE SET NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  vet_profile_id uuid REFERENCES public.vet_profiles(id) ON DELETE SET NULL,

  -- Section 1
  pet_name text,
  pet_age_or_dob text,
  pet_type text,
  pet_type_other text,
  breed text,
  primary_breed text,
  pet_status text,
  date_of_death date,
  clinic_name text,
  clinic_street text,
  clinic_city text,
  clinic_state text,
  clinic_zip text,
  vet_legal_name text,
  license_state text,
  license_number text,
  merchant_id text,
  processor text,
  no_traditional_mid boolean NOT NULL DEFAULT false,

  -- Sections 2-5 answers (checkbox groups)
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Section 6
  certified boolean NOT NULL DEFAULT false,
  signature_typed_name text,
  signed_date date,
  method text NOT NULL DEFAULT 'in_clinic',
  status text NOT NULL DEFAULT 'draft',
  pdf_url text,
  completed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vet_attestations_method_chk CHECK (method IN ('in_clinic','emailed_link','uploaded')),
  CONSTRAINT vet_attestations_status_chk CHECK (status IN ('draft','completed'))
);

GRANT SELECT, INSERT, UPDATE ON public.vet_attestations TO authenticated;
GRANT ALL ON public.vet_attestations TO service_role;

ALTER TABLE public.vet_attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their attestations"
ON public.vet_attestations FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Assigned vets can view attestations"
ON public.vet_attestations FOR SELECT TO authenticated
USING (vet_profile_id IS NOT NULL AND public.is_vet_profile_owner(vet_profile_id, auth.uid()));

CREATE POLICY "Admins can view all attestations"
ON public.vet_attestations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can create draft attestations"
ON public.vet_attestations FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() AND status = 'draft' AND certified = false AND pdf_url IS NULL AND completed_at IS NULL);

CREATE POLICY "Owners can update their draft attestations"
ON public.vet_attestations FOR UPDATE TO authenticated
USING (owner_id = auth.uid() AND status = 'draft')
WITH CHECK (owner_id = auth.uid() AND status = 'draft');

CREATE OR REPLACE FUNCTION public.guard_attestation_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.certified := OLD.certified;
  NEW.pdf_url := OLD.pdf_url;
  NEW.completed_at := OLD.completed_at;
  NEW.signature_typed_name := OLD.signature_typed_name;
  NEW.signed_date := OLD.signed_date;
  NEW.owner_id := OLD.owner_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_attestation_protected_fields
BEFORE UPDATE ON public.vet_attestations
FOR EACH ROW EXECUTE FUNCTION public.guard_attestation_protected_fields();

CREATE TRIGGER trg_vet_attestations_updated_at
BEFORE UPDATE ON public.vet_attestations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vet_attestations_owner ON public.vet_attestations(owner_id);
CREATE INDEX idx_vet_attestations_ticket ON public.vet_attestations(ticket_id);

CREATE TABLE public.attestation_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attestation_id uuid NOT NULL REFERENCES public.vet_attestations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  clinic_email text NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.attestation_link_tokens TO authenticated;
GRANT ALL ON public.attestation_link_tokens TO service_role;

ALTER TABLE public.attestation_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see links they sent"
ON public.attestation_link_tokens FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Admins can see all attestation links"
ON public.attestation_link_tokens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_attestation_tokens_attestation ON public.attestation_link_tokens(attestation_id);