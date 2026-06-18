CREATE POLICY "Ticket participants read estimate and attestation"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vet-tickets'
  AND EXISTS (
    SELECT 1 FROM public.vet_tickets t
    WHERE (t.estimate_url = storage.objects.name OR t.attestation_url = storage.objects.name)
      AND public.can_access_vet_ticket(t.id, auth.uid())
  )
);