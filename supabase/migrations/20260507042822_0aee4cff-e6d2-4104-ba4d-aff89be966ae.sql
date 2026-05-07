-- Webhook event log for replay protection
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  event_id text NOT NULL,
  event_type text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'processed',
  error text,
  CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON public.webhook_events (processed_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view webhook events" ON public.webhook_events;
CREATE POLICY "Admins view webhook events" ON public.webhook_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- DB-level idempotency for bounty/payout/contribution writes
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_bounties_payment_history
  ON public.referral_bounties (payment_history_id)
  WHERE payment_history_id IS NOT NULL AND period IN ('intro','ongoing');

CREATE UNIQUE INDEX IF NOT EXISTS uq_referrer_payouts_stripe_transfer
  ON public.referrer_payouts (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shelter_contrib_payment_history
  ON public.shelter_milestone_contributions (payment_history_id)
  WHERE payment_history_id IS NOT NULL;
