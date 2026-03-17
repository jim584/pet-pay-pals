
-- Create adoption_listings table
CREATE TABLE public.adoption_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'dog',
  breed TEXT,
  age_text TEXT,
  gender TEXT,
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}'::text[],
  shelter_name TEXT NOT NULL,
  shelter_location TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_website TEXT,
  is_adopted BOOLEAN NOT NULL DEFAULT false,
  posted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adoption_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view non-adopted listings
CREATE POLICY "Anon can view adoption listings"
ON public.adoption_listings FOR SELECT TO anon
USING (is_adopted = false);

CREATE POLICY "Authenticated can view adoption listings"
ON public.adoption_listings FOR SELECT TO authenticated
USING (true);

-- Authenticated users can insert own listings
CREATE POLICY "Users can create adoption listings"
ON public.adoption_listings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = posted_by);

-- Poster can update own listings
CREATE POLICY "Users can update own adoption listings"
ON public.adoption_listings FOR UPDATE TO authenticated
USING (auth.uid() = posted_by)
WITH CHECK (auth.uid() = posted_by);

-- Poster can delete own listings
CREATE POLICY "Users can delete own adoption listings"
ON public.adoption_listings FOR DELETE TO authenticated
USING (auth.uid() = posted_by);

-- Admins can manage all
CREATE POLICY "Admins can manage adoption listings"
ON public.adoption_listings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_adoption_listings_updated_at
BEFORE UPDATE ON public.adoption_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
