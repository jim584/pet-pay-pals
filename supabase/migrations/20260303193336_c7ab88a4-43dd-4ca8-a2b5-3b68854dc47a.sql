
-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can assign own initial role" ON public.user_roles;

-- Recreate as permissive
CREATE POLICY "Users can assign own initial role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  AND (role = ANY (ARRAY['pet_owner'::app_role, 'vet'::app_role]))
  AND (NOT user_has_any_role(auth.uid()))
);
