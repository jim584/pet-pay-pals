-- Deduplicate any existing rows by stripe_invoice_id (keep newest), then enforce uniqueness
DELETE FROM public.payment_history a
USING public.payment_history b
WHERE a.stripe_invoice_id IS NOT NULL
  AND a.stripe_invoice_id = b.stripe_invoice_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS payment_history_stripe_invoice_id_key
  ON public.payment_history (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;