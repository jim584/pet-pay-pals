CREATE POLICY "Admins manage vetted import files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'vetted-imports' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'vetted-imports' AND public.has_role(auth.uid(), 'admin'::app_role));