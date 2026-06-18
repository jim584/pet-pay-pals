
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_editor';
ALTER TYPE public.vet_ticket_status ADD VALUE IF NOT EXISTS 'awaiting_secondary_review';
ALTER TYPE public.vet_ticket_status ADD VALUE IF NOT EXISTS 'auto_approved';
