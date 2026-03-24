
-- Admin policies for behave_posts
CREATE POLICY "Admins can view all behave posts"
ON public.behave_posts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any behave post"
ON public.behave_posts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any behave post"
ON public.behave_posts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for behave_images
CREATE POLICY "Admins can update any behave image"
ON public.behave_images FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any behave image"
ON public.behave_images FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for behave_videos
CREATE POLICY "Admins can update any behave video"
ON public.behave_videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any behave video"
ON public.behave_videos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
