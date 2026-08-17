CREATE TABLE public.furensic_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'blog' CHECK (kind IN ('blog','video','podcast')),
  title text NOT NULL,
  summary text,
  body text,
  cover_image_url text,
  media_url text,
  embed_url text,
  media_provider text,
  duration_label text,
  tags text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.furensic_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.furensic_entries TO authenticated;
GRANT ALL ON public.furensic_entries TO service_role;

ALTER TABLE public.furensic_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published furensic entries are public"
ON public.furensic_entries FOR SELECT
USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'));

CREATE POLICY "Editors insert furensic entries"
ON public.furensic_entries FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'));

CREATE POLICY "Editors update furensic entries"
ON public.furensic_entries FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'));

CREATE POLICY "Editors delete furensic entries"
ON public.furensic_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'content_editor'));

CREATE INDEX idx_furensic_entries_kind ON public.furensic_entries (kind, published_at DESC);

CREATE TRIGGER update_furensic_entries_updated_at
BEFORE UPDATE ON public.furensic_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();