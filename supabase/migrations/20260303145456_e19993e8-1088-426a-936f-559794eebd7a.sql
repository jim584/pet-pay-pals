
-- Add unique constraint on profiles.user_id (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Add FK from pet_stories.author_id to profiles.user_id (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_stories_author_profile_fkey') THEN
    ALTER TABLE public.pet_stories
      ADD CONSTRAINT pet_stories_author_profile_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from pets.owner_id to profiles.user_id (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pets_owner_profile_fkey') THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT pets_owner_profile_fkey
      FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;
