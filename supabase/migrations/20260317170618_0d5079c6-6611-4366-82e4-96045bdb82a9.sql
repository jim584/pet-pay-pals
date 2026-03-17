
CREATE TABLE public.vetted_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listed_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price_text text,
  external_url text NOT NULL,
  store_name text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vetted_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vetted products" ON public.vetted_products
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can list products" ON public.vetted_products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = listed_by);

CREATE POLICY "Users can delete own products" ON public.vetted_products
  FOR DELETE TO authenticated USING (auth.uid() = listed_by);

CREATE POLICY "Users can update own products" ON public.vetted_products
  FOR UPDATE TO authenticated USING (auth.uid() = listed_by) WITH CHECK (auth.uid() = listed_by);
