ALTER TABLE public.story_comments
ADD CONSTRAINT story_comments_user_profile_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;