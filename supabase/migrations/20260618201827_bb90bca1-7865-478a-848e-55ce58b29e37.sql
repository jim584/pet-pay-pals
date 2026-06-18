
ALTER TABLE public.vet_tickets
  ADD COLUMN IF NOT EXISTS auto_approval_blockers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bnpl_denied_all_providers boolean DEFAULT false;

ALTER TABLE public.referral_program_settings
  ADD COLUMN IF NOT EXISTS excluded_procedures text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS risk_flag_thresholds jsonb DEFAULT '{"tickets_per_30d": 10, "pets_added_per_7d": 5, "tickets_per_24h": 3}'::jsonb;

ALTER TABLE public.bnpl_obligations
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS plan_term_months int,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS platform_fee_monthly numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS platform_fee_annual numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS transaction_fee_pct numeric DEFAULT 0.05;

CREATE TABLE IF NOT EXISTS public.ticket_reconsideration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.vet_tickets(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ticket_reconsideration_requests TO authenticated;
GRANT ALL ON public.ticket_reconsideration_requests TO service_role;
ALTER TABLE public.ticket_reconsideration_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requesters can view their own requests"
  ON public.ticket_reconsideration_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Requesters can create their own requests"
  ON public.ticket_reconsideration_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.vet_tickets t WHERE t.id = ticket_id AND t.owner_id = auth.uid())
  );
CREATE POLICY "Admins can update reconsideration requests"
  ON public.ticket_reconsideration_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_reconsideration_updated_at
  BEFORE UPDATE ON public.ticket_reconsideration_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'text',
  value_text text,
  value_json jsonb,
  value_image_url text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_blocks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_blocks TO authenticated;
GRANT ALL ON public.content_blocks TO service_role;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read content blocks"
  ON public.content_blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Editors can insert content blocks"
  ON public.content_blocks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'content_editor'::app_role));
CREATE POLICY "Editors can update content blocks"
  ON public.content_blocks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'content_editor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'content_editor'::app_role));
CREATE POLICY "Admins can delete content blocks"
  ON public.content_blocks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON public.content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
