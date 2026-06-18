## Problem

When a vet clicks the **Estimate** (or Attestation) button on an incoming ticket, Supabase Storage replies "Object not found". The signed-URL call fails because the storage policies on the `vet-tickets` bucket only allow:

- The uploader (path's first folder = `auth.uid()`), or
- Admins, or
- Ticket-message attachments (path starts with `messages/`)

The pet owner's estimate/attestation files are stored at `{owner_id}/...`, so an assigned vet can't read them and `createSignedUrl` returns "object not found" (RLS-denied rows are reported as not-found by Storage).

## Fix

Add a new `SELECT` RLS policy on `storage.objects` so any user who can access the ticket (vet or admin, via `public.can_access_vet_ticket`) can read the ticket's `estimate_url` / `attestation_url` objects.

### Migration

```sql
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
```

This piggybacks on the existing `can_access_vet_ticket` security-definer function (owner, assigned vet, or admin) and matches by exact stored path. Owner and admin already had access via other policies — this just unlocks the assigned vet.

No client or edge function changes needed. After the migration applies, the vet's Estimate button will open the file.
