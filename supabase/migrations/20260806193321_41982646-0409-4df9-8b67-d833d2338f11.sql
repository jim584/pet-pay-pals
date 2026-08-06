ALTER TYPE public.vet_payout_status ADD VALUE IF NOT EXISTS 'settled';
ALTER TYPE public.vet_payout_status ADD VALUE IF NOT EXISTS 'cancelled';