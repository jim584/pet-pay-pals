ALTER TABLE public.story_comments
ADD COLUMN parent_comment_id uuid REFERENCES public.story_comments(id) ON DELETE CASCADE DEFAULT NULL;