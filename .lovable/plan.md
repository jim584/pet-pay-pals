# Vet ticket messaging thread

Add a lightweight in-ticket conversation between the **pet owner**, the **assigned vet** (if any), and **admins** so they can ask follow-up questions, request more documents, share updates, etc., directly inside a ticket.

## What the user will see

**Pet Owner — `/dashboard/vet-tickets`**
- Each ticket card gets a **Messages (N)** button.
- Clicking opens a dialog with the message thread, an input box, and a Send button.
- Unread count badge appears on the button when there are new messages from vet/admin.

**Vet — `/dashboard/vet-tickets`** (Incoming Tickets)
- Same Messages button on each incoming ticket card.
- Vet can reply, ask the owner for more info, or post status updates visible to owner + admin.

**Admin — `/admin/vet-tickets`**
- Same Messages button on every ticket in the queue, so admins can join either side of the conversation.

All three see the same shared thread per ticket. Each message shows author name, role badge (Owner / Vet / Admin), timestamp, and body. Newest at the bottom, auto-scroll, basic Enter-to-send.

## Database (1 migration)

New table `vet_ticket_messages`:

```text
id              uuid pk
ticket_id       uuid  -> vet_tickets.id (indexed)
sender_id       uuid  (auth user)
sender_role     text  ('owner' | 'vet' | 'admin')
body            text  not null, length-checked in trigger (1..4000)
read_by_owner   bool  default false
read_by_vet     bool  default false
read_by_admin   bool  default false
created_at      timestamptz default now()
```

RLS (SELECT + INSERT only — no edit/delete to keep an audit trail):

- **SELECT** allowed if any of:
  - `auth.uid()` is the ticket's `owner_id`
  - `auth.uid()` owns the ticket's `vet_profile_id` (via existing `is_vet_profile_owner`)
  - `has_role(auth.uid(), 'admin')`
- **INSERT** allowed under the same conditions, and `sender_id = auth.uid()`. A `BEFORE INSERT` trigger sets `sender_role` automatically based on the user's relationship to the ticket (owner / vet / admin) so the client can't spoof it.
- **UPDATE** allowed only to flip the appropriate `read_by_*` flag for the caller's role (small policy with `WITH CHECK` ensuring only that column changes).

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.vet_ticket_messages;` so the dialog updates live without polling.

## Code changes

**New: `src/lib/vet-ticket-messages-api.ts`**
- `listMessages(ticketId)` — returns messages + joined sender display names from `profiles`.
- `sendMessage(ticketId, body)` — insert; role is set by trigger.
- `markRead(ticketId, role)` — updates the `read_by_{role}` flag for messages not authored by the caller.
- `subscribeToTicketMessages(ticketId, onChange)` — supabase realtime channel.
- `getUnreadCount(ticketId, role)` — count where `read_by_{role}=false AND sender_id <> me`.

**New: `src/components/vet-tickets/TicketMessagesDialog.tsx`**
- Reusable dialog. Props: `ticketId`, `viewerRole: 'owner' | 'vet' | 'admin'`.
- Loads thread, subscribes to realtime, marks read on open, renders bubbles with role badge, has a textarea + Send.

**Edits:**
- `src/pages/VetTicketsPage.tsx`
  - In `TicketCard` (owner view) and `VetIncomingTickets` cards, add a "Messages" button that opens `TicketMessagesDialog` with the appropriate `viewerRole`. Show unread badge.
- `src/pages/AdminVetTicketsPage.tsx`
  - Add the same button on admin ticket cards with `viewerRole="admin"`.

No edge function needed — RLS + trigger handle authorization, realtime handles delivery.

## Out of scope (can be follow-ups)
- Email/push notifications when a new message arrives.
- File attachments inside messages (estimate/attestation files already attach to the ticket itself).
- Editing or deleting messages.
