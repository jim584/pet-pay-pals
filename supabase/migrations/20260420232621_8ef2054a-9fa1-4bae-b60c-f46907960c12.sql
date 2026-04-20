-- Enable pg_cron and pg_net for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove any prior schedule with the same name (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('process-dp-expiry-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule daily at 03:00 UTC
SELECT cron.schedule(
  'process-dp-expiry-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vobbumbhncydapxweukr.supabase.co/functions/v1/process-dp-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmJ1bWJobmN5ZGFweHdldWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDE4NzcsImV4cCI6MjA4NzE3Nzg3N30.fUppwnNlfzgwErUJfuP879sNSumVhE8rmE1ZAZb6a7k'
    ),
    body := jsonb_build_object('scheduled', true)
  ) AS request_id;
  $$
);