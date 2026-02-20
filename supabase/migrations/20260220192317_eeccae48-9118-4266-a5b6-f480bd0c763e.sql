
-- Vet profiles table
CREATE TABLE public.vet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL DEFAULT '',
  specializations TEXT[] DEFAULT '{}',
  location TEXT,
  bio TEXT,
  phone TEXT,
  website TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vet services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.vet_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.vet_profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vet_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER update_vet_profiles_updated_at
BEFORE UPDATE ON public.vet_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check vet profile ownership
CREATE OR REPLACE FUNCTION public.is_vet_profile_owner(_vet_profile_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.vet_profiles WHERE id = _vet_profile_id AND user_id = _user_id)
$$;

-- VET PROFILES RLS
CREATE POLICY "Anyone authenticated can view vet profiles"
ON public.vet_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Vets can insert own profile"
ON public.vet_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'vet'));

CREATE POLICY "Vets can update own profile"
ON public.vet_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any vet profile"
ON public.vet_profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- SERVICES RLS
CREATE POLICY "Anyone can view active services"
ON public.services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Vets can insert own services"
ON public.services FOR INSERT TO authenticated
WITH CHECK (public.is_vet_profile_owner(vet_id, auth.uid()));

CREATE POLICY "Vets can update own services"
ON public.services FOR UPDATE TO authenticated
USING (public.is_vet_profile_owner(vet_id, auth.uid()))
WITH CHECK (public.is_vet_profile_owner(vet_id, auth.uid()));

CREATE POLICY "Vets can delete own services"
ON public.services FOR DELETE TO authenticated
USING (public.is_vet_profile_owner(vet_id, auth.uid()));

-- APPOINTMENTS RLS
CREATE POLICY "Owners can view own appointments"
ON public.appointments FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Vets can view their appointments"
ON public.appointments FOR SELECT TO authenticated
USING (public.is_vet_profile_owner(vet_id, auth.uid()));

CREATE POLICY "Owners can create appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Vets can update appointment status"
ON public.appointments FOR UPDATE TO authenticated
USING (public.is_vet_profile_owner(vet_id, auth.uid()));

CREATE POLICY "Owners can update own appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
