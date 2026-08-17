# Veterinarian Attestation — three ways to complete it

Today a ticket has one attestation touchpoint: an optional file upload plus a checkbox. This turns the attached paper form into a real, structured artifact that can be completed three ways, all ending in the same place — a flattened PDF plus typed, machine-readable answers attached to the ticket.

## The three paths

```text
A. In clinic, on the member's phone
   Member starts ticket -> hands phone to vet/tech -> guided form ->
   vet types /Full Name/ + date -> PDF generated -> attached to ticket

B. Email to the veterinarian
   Member enters clinic email -> we email a secure one-time link ->
   vet completes the same form in a browser -> PDF generated ->
   attached to the member's draft ticket, member notified

C. Print and hand-complete
   Member downloads the blank form (typed-entry PDF preferred) ->
   clinic fills, adds a scanned/PNG signature, flattens ->
   member uploads the PDF with the invoice on the ticket (existing path)
```

Paths A and B produce typed data directly, so no OCR is needed. Path C stays an upload and remains the OCR case later.

## Form content

The form mirrors the attached document exactly: pet/clinic/signer identification (including license state and number, merchant ID or "no traditional MID"), records attached, service types and status, clinical facts, the two eligibility questions, the public-copy notice, the certification checkbox, and the signature block. Sections 4 is skipped automatically when the request is necropsy-only, matching the paper instructions.

Signature is typed: the vet enters their full legal name (rendered as `/Full Name/`) and the date signed. No certified e-signature service.

## Database

New table `vet_attestations`:
- link to `ticket_id` (nullable until the ticket is submitted) and `pet_id`/`owner_id`
- one column group per form section, stored as typed columns plus a `answers jsonb` for the checkbox groups
- signer fields: legal name, license state, license number, signed date, signature method (`in_clinic`, `emailed_link`, `uploaded`)
- `pdf_url` for the generated flattened PDF, `status` (`draft`, `completed`)
- standard timestamps and grants; RLS so the owner and the ticket's vet can read, admins can read all, and only server functions write the signed fields

New table `attestation_link_tokens`: hashed token, attestation id, expiry (7 days), single use, requesting member, clinic email. No public read policy — only the edge function touches it.

`vet_tickets` keeps `attestation_url`; it will point at the generated PDF for paths A and B.

## Server

- `generate-attestation-pdf` — renders the completed answers into a flattened PDF using pdf-lib, uploads to the `vet-tickets` bucket, returns the path. Shared by all paths.
- `send-attestation-request` — member-triggered; creates a draft attestation + token, emails the clinic a branded link with the pet and clinic context.
- `submit-attestation` — accepts either an authenticated in-clinic submission or a valid token submission; validates required fields and the certification checkbox, writes the record, calls PDF generation, links it to the ticket, and notifies the member.
- Public token route is rate-limited and fails closed on expired/used tokens.

## Frontend

- `src/pages/VetTicketsPage.tsx` — in the new-ticket form, replace the single "attestation (optional upload)" row with three clear choices: **Complete now with my vet**, **Email my vet a link**, **Download the form**. Show live status once an emailed attestation is completed.
- `src/components/vet-tickets/AttestationForm.tsx` — the shared multi-step form (mobile-first, large tap targets, typed inputs everywhere), used both in the dialog and on the public token page.
- `src/pages/AttestationPublicPage.tsx` — token-authenticated public route `/attest/:token` for the emailed path, showing pet/clinic context and the same form.
- Blank downloadable form: the uploaded PDF is published as a project asset and linked from the download option.
- Admin ticket view gains a link to the generated attestation PDF plus the structured answers, so review does not depend on reading a scan.

## Notes

- The public redaction notice text is included verbatim in the form; producing the actual redacted public copies is separate work and not in this scope.
- Attestation submission does not change coverage, auto-approval, or funding logic; a completed attestation is simply recorded and attached.
- The meeting transcript mentioned in your message did not come through — only the attestation PDF arrived. If it contains more requirements, send it and I will fold them in.
