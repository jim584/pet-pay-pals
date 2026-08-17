-- Platform settings
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform settings are readable by everyone"
  ON public.platform_settings FOR SELECT USING (true);

CREATE POLICY "Admins manage platform settings"
  ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_platform_settings_updated
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings(key, value, description)
VALUES ('reserve_pool_enabled', 'false'::jsonb, 'When false, the Member Reserve Pool is skipped in the vet ticket funding hierarchy and hidden from members.');

-- Help a Pet Now campaigns
CREATE TYPE public.help_now_campaign_status AS ENUM ('draft','published','funded','expired','cancelled');

CREATE TABLE public.help_now_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.vet_tickets(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  goal_amount numeric NOT NULL DEFAULT 0,
  raised_amount numeric NOT NULL DEFAULT 0,
  status public.help_now_campaign_status NOT NULL DEFAULT 'draft',
  verification_status text NOT NULL DEFAULT 'pending',
  title text,
  story text,
  photo_urls text[] NOT NULL DEFAULT '{}'::text[],
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_now_campaigns_status ON public.help_now_campaigns(status);
CREATE INDEX idx_help_now_campaigns_owner ON public.help_now_campaigns(owner_id);

GRANT SELECT ON public.help_now_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE ON public.help_now_campaigns TO authenticated;
GRANT ALL ON public.help_now_campaigns TO service_role;

ALTER TABLE public.help_now_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published campaigns are public"
  ON public.help_now_campaigns FOR SELECT USING (status <> 'draft');

CREATE POLICY "Owners can view their own campaigns"
  ON public.help_now_campaigns FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all campaigns"
  ON public.help_now_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can update their own campaigns"
  ON public.help_now_campaigns FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can manage all campaigns"
  ON public.help_now_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.guard_help_now_campaign_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Members may only edit title, story and photos. Everything else is server-controlled.
  NEW.ticket_id := OLD.ticket_id;
  NEW.pet_id := OLD.pet_id;
  NEW.owner_id := OLD.owner_id;
  NEW.goal_amount := OLD.goal_amount;
  NEW.raised_amount := OLD.raised_amount;
  NEW.status := OLD.status;
  NEW.verification_status := OLD.verification_status;
  NEW.published_at := OLD.published_at;
  NEW.expires_at := OLD.expires_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_help_now_campaign_guard
  BEFORE UPDATE ON public.help_now_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_help_now_campaign_fields();

CREATE OR REPLACE FUNCTION public.block_help_now_campaign_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Help a Pet Now campaigns are created by the system from a vet ticket';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_help_now_campaign_insert_guard
  BEFORE INSERT ON public.help_now_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.block_help_now_campaign_insert();