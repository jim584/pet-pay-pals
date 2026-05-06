CREATE POLICY "Vets can view tickets assigned to them"
ON public.vet_tickets FOR SELECT
TO authenticated
USING (
  vet_profile_id IS NOT NULL
  AND public.is_vet_profile_owner(vet_profile_id, auth.uid())
);