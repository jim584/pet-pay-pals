# Add a real "Needs info" state to vet tickets

Today, a ticket that can't be auto-approved sits in `under_review` with a list of blockers. Owners see a generic "under review" badge and have no clear action. This adds an explicit **Needs info** state so an admin can ask the submitter for a specific missing item, and the owner sees an "Action required" prompt they can respond to.

## Flow

```text
submitted -> under_review -> needs_info -> under_review -> approved | rejected
                    (admin requests info)   (owner responds)
```

- Admin, on any pending ticket, can click **Request info**, type what is missing, and move the ticket to `needs_info`.
- Owner sees an "Action required" card with the admin's message, can upload a replacement/additional document and/or write a reply, then submits — ticket returns to `under_review` and the admin sees the response.
- Approve / Reject remain available to the admin from `needs_info` as well.

## Database

- Add `needs_info` to the `vet_ticket_status` enum.
- Add columns to `vet_tickets`: `info_request_message text`, `info_requested_at timestamptz`, `info_requested_by uuid`, `info_response_message text`, `info_responded_at timestamptz`.
- Update the `guard_vet_ticket_protected_fields` trigger so:
  - clients still cannot set status directly, except the new owner transition `needs_info -> under_review` performed through the server function;
  - `info_request_*` columns remain server/admin-only.

## Server

- New edge function `request-ticket-info`: admin-only (verifies `has_role(admin)`), validates a non-empty message, sets status `needs_info` plus the request fields, and posts the message into `vet_ticket_messages` so it appears in the ticket thread.
- New edge function `respond-ticket-info`: caller must be the ticket owner (or its vet), requires ticket in `needs_info`, accepts a reply message and optional uploaded document URL, records the response, posts to `vet_ticket_messages`, and sets status back to `under_review`.
- Both keep the existing fail-closed pattern: no status change on validation error.

## Frontend

- `src/lib/vet-tickets-api.ts`: add `needs_info` to the `VetTicketStatus` union, add `requestTicketInfo()` and `respondTicketInfo()` wrappers, extend the ticket type with the new fields.
- `src/pages/AdminVetTicketsPage.tsx`: add `needs_info` to the status filter list and badge variants (warning tone), add a **Request info** button with a message dialog on pending tickets, and show the owner's response when present.
- `src/pages/VetTicketsPage.tsx`: add the badge variant, and on a `needs_info` ticket render an "Action required" block with the admin's message, a file upload, a reply textarea, and a Send response button.

## Notes

- No change to coverage, funding, or BNPL logic — this is purely an additional review state.
- Existing `under_review` tickets are unaffected; nothing is auto-migrated.
