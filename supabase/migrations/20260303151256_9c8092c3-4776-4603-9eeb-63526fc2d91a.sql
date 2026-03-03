-- Allow anonymous users to view pet stories in the public feed
CREATE POLICY "Anon can view stories"
ON public.pet_stories
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to view pets (for feed cards)
CREATE POLICY "Anon can view pets"
ON public.pets
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to view profiles (for author names in feed)
CREATE POLICY "Anon can view profiles"
ON public.profiles
FOR SELECT
TO anon
USING (true);