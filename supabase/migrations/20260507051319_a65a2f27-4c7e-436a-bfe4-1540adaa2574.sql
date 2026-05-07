
CREATE TABLE public.vet_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('owner','vet','admin')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_by_owner boolean NOT NULL DEFAULT false,
  read_by_vet boolean NOT NULL DEFAULT false,
  read_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vet_ticket_messages_ticket ON public.vet_ticket_messages(ticket_id, created_at);

ALTER TABLE public.vet_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Helper: can the user access this ticket's thread?
CREATE OR REPLACE FUNCTION public.can_access_vet_ticket(_ticket_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vet_tickets t
    WHERE t.id = _ticket_id
      AND (
        t.owner_id = _user_id
        OR (t.vet_profile_id IS NOT NULL AND public.is_vet_profile_owner(t.vet_profile_id, _user_id))
        OR public.has_role(_user_id, 'admin'::app_role)
      )
  )
$$;

-- Determine caller role for a given ticket (used by trigger)
CREATE OR REPLACE FUNCTION public.vet_ticket_role_for(_ticket_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _vp uuid;
BEGIN
  SELECT owner_id, vet_profile_id INTO _owner, _vp
    FROM public.vet_tickets WHERE id = _ticket_id;
  IF _owner IS NULL THEN RETURN NULL; END IF;
  -- admin first if multi-role; owner takes priority over admin if they own
  IF _owner = _user_id THEN RETURN 'owner'; END IF;
  IF _vp IS NOT NULL AND public.is_vet_profile_owner(_vp, _user_id) THEN RETURN 'vet'; END IF;
  IF public.has_role(_user_id, 'admin'::app_role) THEN RETURN 'admin'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.vet_ticket_messages_set_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _role text;
BEGIN
  IF NEW.sender_id IS NULL THEN
    NEW.sender_id := auth.uid();
  END IF;
  IF NEW.sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  _role := public.vet_ticket_role_for(NEW.ticket_id, NEW.sender_id);
  IF _role IS NULL THEN
    RAISE EXCEPTION 'No access to this ticket';
  END IF;
  NEW.sender_role := _role;
  -- auto-mark sender's own role as read
  IF _role = 'owner' THEN NEW.read_by_owner := true; END IF;
  IF _role = 'vet' THEN NEW.read_by_vet := true; END IF;
  IF _role = 'admin' THEN NEW.read_by_admin := true; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vet_ticket_messages_set_role
BEFORE INSERT ON public.vet_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.vet_ticket_messages_set_role();

-- RLS policies
CREATE POLICY "Participants view ticket messages"
  ON public.vet_ticket_messages FOR SELECT
  TO authenticated
  USING (public.can_access_vet_ticket(ticket_id, auth.uid()));

CREATE POLICY "Participants send ticket messages"
  ON public.vet_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can_access_vet_ticket(ticket_id, auth.uid())
  );

CREATE POLICY "Participants mark messages read"
  ON public.vet_ticket_messages FOR UPDATE
  TO authenticated
  USING (public.can_access_vet_ticket(ticket_id, auth.uid()))
  WITH CHECK (public.can_access_vet_ticket(ticket_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.vet_ticket_messages;
ALTER TABLE public.vet_ticket_messages REPLICA IDENTITY FULL;
