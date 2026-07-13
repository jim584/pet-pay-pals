
CREATE TABLE public.verification_state_flags (
  state_code TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  disabled_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.verification_state_flags TO authenticated;
GRANT ALL ON public.verification_state_flags TO service_role;

ALTER TABLE public.verification_state_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read state flags"
  ON public.verification_state_flags FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upsert state flags"
  ON public.verification_state_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update state flags"
  ON public.verification_state_flags FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
