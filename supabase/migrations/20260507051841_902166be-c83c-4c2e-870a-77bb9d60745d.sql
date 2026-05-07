
CREATE POLICY "Ticket participants read message attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vet-tickets'
    AND (storage.foldername(name))[1] = 'messages'
    AND public.can_access_vet_ticket(((storage.foldername(name))[2])::uuid, auth.uid())
  );

CREATE POLICY "Ticket participants upload message attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vet-tickets'
    AND (storage.foldername(name))[1] = 'messages'
    AND public.can_access_vet_ticket(((storage.foldername(name))[2])::uuid, auth.uid())
  );
