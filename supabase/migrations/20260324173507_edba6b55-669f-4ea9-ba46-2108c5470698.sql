
-- sponsorship_pets table
CREATE TABLE public.sponsorship_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'dog',
  description TEXT,
  condition_details TEXT,
  photo_url TEXT,
  sponsorship_status TEXT NOT NULL DEFAULT 'not_sponsored',
  sponsorship_goal NUMERIC NOT NULL DEFAULT 0,
  sponsorship_raised NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsorship_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sponsorship pets" ON public.sponsorship_pets
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins can insert sponsorship pets" ON public.sponsorship_pets
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sponsorship pets" ON public.sponsorship_pets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sponsorship pets" ON public.sponsorship_pets
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- sponsorship_donations table
CREATE TABLE public.sponsorship_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.sponsorship_pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  donor_name TEXT,
  donor_email TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsorship_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own donations" ON public.sponsorship_donations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own donations" ON public.sponsorship_donations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all donations" ON public.sponsorship_donations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-update sponsorship_raised and status
CREATE OR REPLACE FUNCTION public.update_sponsorship_on_donation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_raised NUMERIC;
  _goal NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO _new_raised
  FROM public.sponsorship_donations WHERE pet_id = NEW.pet_id;

  SELECT sponsorship_goal INTO _goal
  FROM public.sponsorship_pets WHERE id = NEW.pet_id;

  UPDATE public.sponsorship_pets
  SET sponsorship_raised = _new_raised,
      sponsorship_status = CASE
        WHEN _new_raised >= _goal AND _goal > 0 THEN 'sponsored'
        WHEN _new_raised > 0 THEN 'partially_sponsored'
        ELSE 'not_sponsored'
      END,
      updated_at = now()
  WHERE id = NEW.pet_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sponsorship_donation_insert
  AFTER INSERT ON public.sponsorship_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_sponsorship_on_donation();

-- updated_at trigger for sponsorship_pets
CREATE TRIGGER update_sponsorship_pets_updated_at
  BEFORE UPDATE ON public.sponsorship_pets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
