ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS vet_ticket_id uuid,
  ADD COLUMN IF NOT EXISTS bnpl_obligation_id uuid;

CREATE INDEX IF NOT EXISTS idx_payment_history_vet_ticket_id
  ON public.payment_history(vet_ticket_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_bnpl_obligation_id
  ON public.payment_history(bnpl_obligation_id);