
CREATE TABLE public.bnpl_processor_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid,
  trigger_source text NOT NULL DEFAULT 'manual',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  installments_marked_due integer NOT NULL DEFAULT 0,
  installments_marked_missed integer NOT NULL DEFAULT 0,
  obligations_defaulted integer NOT NULL DEFAULT 0,
  reminders_sent integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bnpl_processor_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view processor runs"
  ON public.bnpl_processor_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bnpl_processor_runs_started_at
  ON public.bnpl_processor_runs (started_at DESC);
