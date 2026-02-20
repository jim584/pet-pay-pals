
-- Create pets table
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT,
  species TEXT NOT NULL DEFAULT 'dog',
  age_years INTEGER,
  weight_kg NUMERIC(6,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create health_records table
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vet_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create emergency_contacts table
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER update_pets_updated_at
BEFORE UPDATE ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check pet ownership (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_pet_owner(_pet_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pets WHERE id = _pet_id AND owner_id = _user_id
  )
$$;

-- Pets RLS
CREATE POLICY "Owners can view own pets"
ON public.pets FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert own pets"
ON public.pets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own pets"
ON public.pets FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own pets"
ON public.pets FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- Vets can view pets (for appointments later)
CREATE POLICY "Vets can view pets"
ON public.pets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'vet'));

-- Admins can view all pets
CREATE POLICY "Admins can view all pets"
ON public.pets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Health records RLS
CREATE POLICY "Pet owners can view health records"
ON public.health_records FOR SELECT TO authenticated
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Pet owners can insert health records"
ON public.health_records FOR INSERT TO authenticated
WITH CHECK (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Pet owners can update health records"
ON public.health_records FOR UPDATE TO authenticated
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Pet owners can delete health records"
ON public.health_records FOR DELETE TO authenticated
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Vets can view health records"
ON public.health_records FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pets WHERE pets.id = health_records.pet_id
) AND public.has_role(auth.uid(), 'vet'));

-- Emergency contacts RLS
CREATE POLICY "Pet owners can view emergency contacts"
ON public.emergency_contacts FOR SELECT TO authenticated
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Pet owners can insert emergency contacts"
ON public.emergency_contacts FOR INSERT TO authenticated
WITH CHECK (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Pet owners can update emergency contacts"
ON public.emergency_contacts FOR UPDATE TO authenticated
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Pet owners can delete emergency contacts"
ON public.emergency_contacts FOR DELETE TO authenticated
USING (public.is_pet_owner(pet_id, auth.uid()));
