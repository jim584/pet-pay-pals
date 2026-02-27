
-- 1. Create pet_follows table
CREATE TABLE public.pet_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, pet_id)
);

ALTER TABLE public.pet_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follows (for counts)
CREATE POLICY "Anyone can view follows"
  ON public.pet_follows FOR SELECT
  USING (true);

-- Authenticated users can follow
CREATE POLICY "Users can follow pets"
  ON public.pet_follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow pets"
  ON public.pet_follows FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Add followers_count to pets
ALTER TABLE public.pets ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;

-- 3. Trigger to maintain followers_count
CREATE OR REPLACE FUNCTION public.update_pet_followers_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pets SET followers_count = followers_count + 1 WHERE id = NEW.pet_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pets SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.pet_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_pet_follow_change
  AFTER INSERT OR DELETE ON public.pet_follows
  FOR EACH ROW EXECUTE FUNCTION public.update_pet_followers_count();
