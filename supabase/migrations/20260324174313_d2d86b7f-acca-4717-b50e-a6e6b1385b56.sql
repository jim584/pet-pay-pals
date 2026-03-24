
-- Add reaction_type to story_likes
ALTER TABLE public.story_likes ADD COLUMN reaction_type TEXT NOT NULL DEFAULT 'pray';

-- Add reaction_type to comment_likes
ALTER TABLE public.comment_likes ADD COLUMN reaction_type TEXT NOT NULL DEFAULT 'pray';

-- Allow users to update their own reactions (change reaction type)
CREATE POLICY "Users can update own story likes"
ON public.story_likes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comment likes"
ON public.comment_likes
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
