# Veterinarian Signup & Manual Verification

Two distinct signup paths (Member vs Veterinarian), a veterinarian-specific form backed by the state license database, a live-capture identity photo, and a real `pending_verification → verified` account status that gates all veterinarian actions.

## Signup flow

```text
Choose account type
  ├─ Individual / Member ──> existing flow (unchanged)
  └─ Veterinarian
        Step 1  Account: first name, last name, email, password
        Step 2  Credentials: license number, state, Merchant ID
                 └─ live check against the state license database
        Step 3  Identity photo: live camera capture, holding ID
        Step 4  Submitted → account created, status "Pending Verification"
                 └─ manual admin review → Verified (or Rejected)
```

## Veterinarian signup form

Fields: first name, last name, email, password, veterinary credential/license number, state, Merchant ID.

- Merchant ID helper text: "You can find your Merchant ID on one of your credit-card processing receipts."
- As the license number + state are entered, the form looks the vet up in the license database (Point #1 work) and shows the matched licensee name for confirmation.
- If no active record matches (including states whose data isn't imported yet), signup still proceeds — the account is created and flagged `license_not_in_database` so admins see it during review.
- Full legal name for verification is taken from first + last name, so the automated license check can run in the background.

## Identity photo — live capture only

- Captured in-browser via `getUserMedia` (rear/front camera), rendered to a canvas, uploaded as a fresh capture. No file picker, no drag-and-drop, no gallery upload path exists in the UI.
- On-screen guidance: hold your government ID next to your face, ensure both are readable.
- Desktop / no-camera path: a "Continue on your phone" button emails a one-time link to the vet's own email; opening it on a phone shows only the capture step and completes the pending signup.
- The image is stored in a private bucket; only admins and the vet themselves can retrieve it (via short-lived signed URL). It is never public.

## Account status as a real field

`vet_profiles.account_status`: `pending_verification` | `verified` | `rejected`.

- Created as `pending_verification` on signup — never auto-approved, regardless of what the automated license check returns (the automated result is advisory input for the reviewer).
- While pending, the vet dashboard shows a review banner: "Your account is under review. Verification usually takes 24–72 hours." All veterinarian actions are blocked — no services, no tickets, no attestations, no appointments, no vet-of-record selection by members.
- Blocking is enforced at the database boundary (policies + server-side checks), not only by hiding pages.
- `rejected` shows the admin's reason and a way to resubmit.

## Existing veterinarians

All current vet accounts move to `pending_verification` and must submit a live identity photo before regaining veterinarian actions. They see the same review banner with a "Complete identity verification" action.

## Admin review

The admin vet detail page gains a Verification panel: identity photo (signed URL), submitted credential fields, Merchant ID, the license-database match result (matched / not found / name mismatch), and Approve / Reject with a reason. Approving sets `verified` and unlocks access; the action is recorded with reviewer and timestamp.

---

## Technical notes

**Database**
- `vet_account_status` enum; `vet_profiles`: `account_status`, `first_name`, `last_name`, `merchant_id`, `identity_photo_path`, `identity_photo_captured_at`, `identity_verified_by`, `identity_reviewed_at`, `rejection_reason`, `license_db_match` (jsonb).
- Backfill: all existing rows → `pending_verification`; keep `is_approved` in sync (`verified` ⇒ true) so existing gating code keeps working.
- Trigger guarding `account_status`, `identity_*`, and `merchant_id` against client writes (same pattern as `guard_vet_profile_verification_fields`).
- RLS on vet-owned writes (services, appointments, tickets, attestations) requires `account_status = 'verified'` via a `is_verified_vet(uuid)` security-definer helper.
- Private storage bucket `vet-identity` with owner-or-admin read policies.

**Edge functions**
- `vet-signup-submit`: validates the payload with Zod, stores credential fields + identity photo reference, sets `pending_verification`, records the license-database match, and triggers the existing `verify-vet-license` check as advisory.
- `vet-identity-link`: issues/consumes a one-time hashed token (new `vet_identity_tokens` table) for the phone-capture handoff, mirroring the attestation-token pattern.
- `admin-review-vet`: admin-only approve/reject, sets status, reviewer, timestamp, reason.

**Frontend**
- `src/pages/Auth.tsx`: account-type selector (Member / Veterinarian) driving the form shown; `SelectRole` stays for existing users but the vet branch routes into the new flow.
- New `src/components/vet/VetSignupForm.tsx` (multi-step), `src/components/vet/IdentityCapture.tsx` (camera-only), `src/pages/VetIdentityCapturePage.tsx` at `/vet-identity/:token`.
- New `src/components/vet/PendingVerificationGate.tsx` wrapping vet dashboard routes; `DashboardSidebar` hides vet actions while pending.
- `src/pages/admin/AdminVetDetailPage.tsx` + `AdminVetsPage.tsx`: status column, filter for pending, verification panel.
- `src/lib/vet-api.ts`: status types and the new API wrappers.
