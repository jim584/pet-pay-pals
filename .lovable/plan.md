# Plan B — Vet of Record + Fear Free verification

Adds the missing concept of a member's primary vet, plus admin-verified Fear Free certification on vet profiles, and wires Fear Free **member** status to the existing 5% loyalty discount.

## 1. Schema changes (one migration)

**`vet_profiles` — verification fields:**
- `license_number text`
- `license_state text`
- `license_document_url text` — stored in a new private `vet-credentials` storage bucket
- `is_license_verified boolean default false`
- `fear_free_certified boolean default false` — admin-set
- `fear_free_cert_number text`
- `fear_free_cert_url text`
- `fear_free_verified_at timestamptz`
- `fear_free_verified_by uuid`

**`pets` — primary vet link:**
- `vet_of_record_id uuid` (nullable; references `vet_profiles.id` ON DELETE SET NULL)
- `vet_of_record_set_at timestamptz`

**`memberships` — derived flag for billing logic:**
- Already has `is_fear_free_member boolean`. Keep as-is. We'll just populate it correctly (see step 4).

**Storage:** create private bucket `vet-credentials` with RLS — vet can upload their own; admin can read all.

**RLS:** existing `vet_profiles` policies already cover read/update. New columns inherit. Admin-only writes for `is_license_verified` / `fear_free_certified` / `fear_free_verified_*` enforced via a trigger that strips those fields from non-admin updates.

## 2. Pet onboarding — pick a Vet of Record

- `PetFormDialog.tsx`: add a **"Primary vet (Vet of Record)"** combobox listing approved vet profiles (`is_approved = true`), searchable by clinic name + location. Optional at first save (so existing flows don't break), but show a yellow nudge "Add your Vet of Record to unlock Fear Free pricing."
- On save, write `vet_of_record_id` + `vet_of_record_set_at`.
- Show a small "Vet of Record" card on `PetDetail` with change/remove.

## 3. Vet profile — credential submission

- `VetProfileSetup.tsx`: add fields for license number/state, license document upload, Fear Free cert number, Fear Free cert upload.
- Files go to `vet-credentials/{vet_user_id}/...`.
- After upload, profile flips to "Pending verification."

## 4. Admin verification queue

- `AdminVetDetailPage.tsx`: add a **Verification** card with three toggles + signed-URL viewers for the uploaded docs:
  - Approve clinic (existing `is_approved`)
  - Verify license (`is_license_verified`)
  - Verify Fear Free cert (`fear_free_certified` + sets `fear_free_verified_at`/`_by`)
- Add a filter chip "Pending verification" in `AdminVetsPage.tsx`.

## 5. Wire Fear Free member status into billing

Today the user toggles "Fear Free member" themselves on the plans page — it's self-declared and grants the 5% discount with no proof. Replace that with derivation:

- A member is **Fear Free** iff their pet's Vet of Record has `fear_free_certified = true`.
- `PlansPage.tsx`: replace the manual switch with auto-detection from the user's pets. If at least one pet's VoR is Fear Free certified → show "Fear Free pricing applied (verified via Dr. X)". Otherwise hide the discount line entirely.
- `create-checkout`: stop trusting `is_fear_free_member` from the request body; recompute server-side from the user's pets → vet_of_record → `fear_free_certified`. Pass the verified value into Stripe metadata and into `memberships.is_fear_free_member`.
- `stripe-webhook`: no logic change — it already reads `is_fear_free_member` from session metadata and uses it for DP accrual math.

## 6. Fear Free discount itself
The 5% loyalty discount math (`fear_free_member_charge` column on `membership_plans`) already exists and is applied — no change. We're just gating who qualifies.

## What this does NOT do
- Does not change the 70/10/20 split.
- Does not touch the Reserve (Plan C).
- Does not introduce copay-waiver logic on tickets — that can be a follow-up if desired; today Fear Free only unlocks the 5% membership discount.
- Does not auto-issue emails about verification status (email senders remain dark until DNS).

## Order of work
1. Migration (schema + storage bucket + admin-only trigger).
2. Vet credential upload UI in `VetProfileSetup`.
3. Admin verification UI in `AdminVetDetailPage` + filter chip.
4. Vet of Record picker in `PetFormDialog` + display on `PetDetail`.
5. Replace self-declared Fear Free toggle on `PlansPage` with derived state.
6. Server-side recompute in `create-checkout`.

## After B ships
Plan C (per-member Reserve, continuous-12-months eligibility, optional toggle in ticket coverage UI) — already specced from your last answers.
