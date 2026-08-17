-- 1. Extend vetted_products into a mirror table
ALTER TABLE public.vetted_products
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy_manual',
  ADD COLUMN IF NOT EXISTS source_product_id text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS price_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS delisted_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.vetted_products ALTER COLUMN listed_by DROP NOT NULL;

-- Existing hand-added rows become legacy and drop out of the public grid
UPDATE public.vetted_products
  SET source = 'legacy_manual', approved = false, approval_status = 'legacy_manual'
  WHERE source = 'legacy_manual';

CREATE UNIQUE INDEX IF NOT EXISTS vetted_products_source_key
  ON public.vetted_products (source, source_product_id)
  WHERE source_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vetted_products_visible_idx
  ON public.vetted_products (approved, delisted_at, admin_hidden, created_at DESC);

DROP TRIGGER IF EXISTS trg_vetted_products_updated ON public.vetted_products;
CREATE TRIGGER trg_vetted_products_updated
  BEFORE UPDATE ON public.vetted_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Lock down writes: read-only mirror
DROP POLICY IF EXISTS "Anyone can view vetted products" ON public.vetted_products;
DROP POLICY IF EXISTS "Users can list products" ON public.vetted_products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.vetted_products;
DROP POLICY IF EXISTS "Users can update own products" ON public.vetted_products;

CREATE POLICY "Anyone can view approved vetted products"
  ON public.vetted_products FOR SELECT TO anon, authenticated
  USING (approved = true AND delisted_at IS NULL AND admin_hidden = false);

CREATE POLICY "Admins can view all vetted products"
  ON public.vetted_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage vetted products"
  ON public.vetted_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.vetted_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vetted_products TO authenticated;
GRANT ALL ON public.vetted_products TO service_role;

-- 3. Sync run log
CREATE TABLE IF NOT EXISTS public.vetted_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  mode text NOT NULL DEFAULT 'file_import',
  status text NOT NULL DEFAULT 'running',
  filename text,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  delisted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vetted_sync_runs TO authenticated;
GRANT ALL ON public.vetted_sync_runs TO service_role;
ALTER TABLE public.vetted_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view sync runs" ON public.vetted_sync_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Sync configuration (feed adapter, disabled until Vetted confirms the method)
CREATE TABLE IF NOT EXISTS public.vetted_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL UNIQUE DEFAULT 'vetted',
  adapter text NOT NULL DEFAULT 'file_import',
  feed_url text,
  auth_header_name text,
  enabled boolean NOT NULL DEFAULT false,
  notes text,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vetted_sync_config TO authenticated;
GRANT ALL ON public.vetted_sync_config TO service_role;
ALTER TABLE public.vetted_sync_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage sync config" ON public.vetted_sync_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_vetted_sync_config_updated ON public.vetted_sync_config;
CREATE TRIGGER trg_vetted_sync_config_updated
  BEFORE UPDATE ON public.vetted_sync_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vetted_sync_config (source, adapter, enabled, notes)
  VALUES ('vetted', 'file_import', false, 'Delivery method pending confirmation from the Vetted team.')
  ON CONFLICT (source) DO NOTHING;