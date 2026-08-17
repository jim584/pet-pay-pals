# Attestation, Invoice OCR and Ticket Cross-Verification

## What already exists (verified in the codebase)

- Digital attestation form covering pet, clinic, veterinarian identity (legal name, license state/number, Merchant ID, processor, "No traditional MID"), records-attached checklist, service types and status, necropsy, diagnosis, prognosis, latest start time, likely result, both eligibility questions, certification text and typed signature + date. Three paths: in-clinic, emailed one-time link, upload of a signed copy. Technician-prepared / vet-signed is already the model.
- `vet_attestations` table with all of those columns, a flattened PDF generator, and the public token page.
- Veterinarian license database (`vet_license_records`) plus verified vet accounts (`vet_profiles`).
- Ticket submission currently accepts exactly two files: one estimate/invoice and one attestation.

## What this adds

### 1. Vet selection and prefill in the ticket flow

Ticket step 1 gets a vet picker that searches verified Help a Pet vet accounts first, then the licensed-vet database. Choosing a verified account prefills the attestation with clinic name, street, city, state, ZIP, vet legal name, license state/number, Merchant ID and processor; the vet edits and signs. Phone is stored on the profile for internal use only and stays off the attestation.

### 2. Multi-document submission

A new `ticket_documents` table replaces the single-file model. Each row: ticket, category, storage path, filename, uploaded-by. Categories: itemized estimate/invoice, chart note / discharge summary, labs, imaging, specialist records, preventive-care records, behavior / emotional-wellbeing records. At least one estimate/invoice stays required; the rest are optional. Existing `estimate_url` / `attestation_url` are kept and backfilled as documents so nothing already submitted breaks.

### 3. Line-item classification

Each attestation service type already exists; the extraction adds per-line-item classification (illness/injury, routine/preventive, elective spay-neuter, end-of-life/postmortem, cosmetic-nontherapeutic, unclassified) so mixed visits can be split by category later for eligibility and funding.

### 4. Invoice/estimate extraction

A `parse-ticket-document` edge function runs on every uploaded estimate/invoice and pulls the PDF text layer to extract: clinic name, clinic address, service dates, line-item descriptions, per-line charges, and the document total. Results go to `document_extractions` (structured JSON + confidence + raw text).

Important limitation of text-layer-only extraction: scanned documents and phone photos carry no text layer. Those produce an `unreadable` extraction, which raises a "could not be read automatically — manual review" flag rather than passing silently.

### 5. Cross-verification and flags

After extraction and attestation signing, a checker compares:

| Compared | Sources |
|---|---|
| Clinic name | attestation vs invoice vs vet profile |
| Clinic city/state/ZIP | attestation vs invoice |
| Veterinarian name / license | attestation vs licensed-vet database vs invoice |
| Merchant ID | attestation vs vet profile |
| Amount | requested amount vs invoice total |
| Service categories | attestation service types vs invoice line items |
| Document set | records-attached checklist vs actually uploaded documents |

Every disagreement is written to `ticket_verification_flags` (type, severity, expected value, found value). Names are compared case- and punctuation-insensitively with a fuzzy match so "ABC Animal Hospital, Inc." and "ABC Animal Hospital" agree; anything below the match bar is a flag, not a silent pass.

**Any open flag blocks auto-approval.** The ticket routes to admin review with the flag list shown, and an admin resolves each flag (acknowledge or reject the ticket) before it can move forward. No tolerance thresholds are invented — a mismatch is a mismatch until you define tolerances.

### 6. Public verification copy (structured card)

Help a Pet generates the public copy automatically; the member never redacts anything. A public route `/verify/:token` renders a structured, view-only verification card built from extracted and attested data:

- Shown: clinic name, city, state, ZIP, service dates, service descriptions, charges, total, service categories, and non-identifying attestation answers (diagnosis status, prognosis, urgency, eligibility answers).
- Never included: clinic street address and contact details, member/owner identifiers, pet identifiers, veterinarian and staff identifying details, signatures, license information, Merchant ID, processor and account identifiers, and the original document files.

Because the card is assembled from an allow-list of fields, no original document pixels or private fields can leak through a missed redaction. No download option, no print-friendly export, and the storage bucket stays private.

### 7. Admin review surface

The admin ticket detail page gains a verification panel: attestation summary, document list with categories, extracted invoice line items, and the flag list with resolve controls.

## Technical notes

- New tables: `ticket_documents`, `document_extractions`, `ticket_verification_flags`, plus `public_verification_token` on `vet_tickets`. All RLS-scoped to owner / assigned vet / admin, with GRANTs; the public card is served by an edge function using the token, not by direct anon table reads.
- New edge functions: `parse-ticket-document` (text-layer extraction), `verify-ticket-consistency` (cross-checks and flag writing), `public-ticket-verification` (allow-listed public payload by token).
- `submit-vet-ticket` gains a hard rule: unresolved flags force `under_review` and never auto-approve.
- Frontend: vet picker + prefill in the ticket dialog, multi-category uploader, member-facing flag notice, admin verification panel, public verification page.

## Left for you to decide later

Amount tolerance percentages, which flag types could ever auto-clear, and how the verified data feeds funding lane and campaign priority. Until then everything flags and everything waits for a human.
