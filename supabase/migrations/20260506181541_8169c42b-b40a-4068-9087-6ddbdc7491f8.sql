
CREATE OR REPLACE FUNCTION public.set_status_context(_source text, _changer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.status_source', COALESCE(_source, 'system'), false);
  PERFORM set_config('app.status_changer', COALESCE(_changer::text, ''), false);
END;
$$;

REVOKE ALL ON FUNCTION public.set_status_context(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_status_context(text, uuid) TO authenticated, service_role;
