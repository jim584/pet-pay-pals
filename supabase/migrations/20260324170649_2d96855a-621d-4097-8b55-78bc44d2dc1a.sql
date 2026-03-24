
-- behave_posts (Training Blog)
CREATE TABLE public.behave_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  featured_image_url text,
  category text NOT NULL DEFAULT 'training-tips',
  tags text[] DEFAULT '{}',
  excerpt text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.behave_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published behave posts" ON public.behave_posts FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Authors can insert own behave posts" ON public.behave_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own behave posts" ON public.behave_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete own behave posts" ON public.behave_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER update_behave_posts_updated_at BEFORE UPDATE ON public.behave_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- behave_images (Image Gallery)
CREATE TABLE public.behave_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.behave_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view behave images" ON public.behave_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can insert own behave images" ON public.behave_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can update own behave images" ON public.behave_images FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can delete own behave images" ON public.behave_images FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- behave_videos (Video Library)
CREATE TABLE public.behave_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.behave_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view behave videos" ON public.behave_videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can insert own behave videos" ON public.behave_videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can update own behave videos" ON public.behave_videos FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can delete own behave videos" ON public.behave_videos FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- Storage bucket for behave media
INSERT INTO storage.buckets (id, name, public) VALUES ('behave-media', 'behave-media', true);

-- Storage RLS
CREATE POLICY "Anyone can view behave media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'behave-media');
CREATE POLICY "Authenticated users can upload behave media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'behave-media');
CREATE POLICY "Users can update own behave media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'behave-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own behave media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'behave-media' AND (storage.foldername(name))[1] = auth.uid()::text);
