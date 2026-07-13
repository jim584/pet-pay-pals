-- Purge legacy raw board HTML snippets from previously stored verification
-- attempts and vet_profile verification records. Going forward the edge
-- function only writes the structured `decision` object, but historical rows
-- may still contain a `snippet` or `raw` string. Strip everything except
-- `decision` so we're not sitting on unnecessary board response bodies.

UPDATE public.vet_verification_attempts
SET payload = jsonb_build_object('decision', payload->'decision')
WHERE payload IS NOT NULL
  AND jsonb_typeof(payload) = 'object'
  AND payload ? 'decision'
  AND (payload ? 'snippet' OR payload ? 'raw');

UPDATE public.vet_verification_attempts
SET payload = NULL
WHERE payload IS NOT NULL
  AND jsonb_typeof(payload) = 'object'
  AND NOT (payload ? 'decision')
  AND (payload ? 'snippet' OR payload ? 'raw');

UPDATE public.vet_profiles
SET verification_raw = jsonb_build_object('decision', verification_raw->'decision')
WHERE verification_raw IS NOT NULL
  AND jsonb_typeof(verification_raw) = 'object'
  AND verification_raw ? 'decision'
  AND (verification_raw ? 'snippet' OR verification_raw ? 'raw');

UPDATE public.vet_profiles
SET verification_raw = NULL
WHERE verification_raw IS NOT NULL
  AND jsonb_typeof(verification_raw) = 'object'
  AND NOT (verification_raw ? 'decision')
  AND (verification_raw ? 'snippet' OR verification_raw ? 'raw');
