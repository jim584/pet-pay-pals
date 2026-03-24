

## Plan: "Help a Pet Overcome" Page

Build a structured, section-based sponsorship page (not a blog feed) where users can sponsor pets needing extra care, with full admin CRUD.

### 1. Database: New `sponsorship_pets` table

```sql
CREATE TABLE public.sponsorship_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'dog',
  description TEXT,
  condition_details TEXT,
  photo_url TEXT,
  sponsorship_status TEXT NOT NULL DEFAULT 'not_sponsored',  -- not_sponsored, partially_sponsored, sponsored
  sponsorship_goal NUMERIC DEFAULT 0,
  sponsorship_raised NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS policies:
- Anyone (anon + authenticated) can SELECT active pets
- Admins can INSERT/UPDATE/DELETE (using `has_role`)

### 2. Database: New `sponsorship_donations` table

```sql
CREATE TABLE public.sponsorship_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES sponsorship_pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  donor_name TEXT,
  donor_email TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS policies:
- Users can INSERT own donations (`auth.uid() = user_id`)
- Users can SELECT own donations
- Admins can SELECT all donations

### 3. API layer: `src/lib/overcome-api.ts`

- `fetchSponsorshipPets()` — list active pets
- `fetchSponsorshipPet(id)` — single pet detail
- `createSponsorshipPet(data)` — admin create
- `updateSponsorshipPet(id, data)` — admin update
- `deleteSponsorshipPet(id)` — admin delete
- `submitDonation(data)` — user submits sponsorship donation
- Updates `sponsorship_raised` on the pet after donation via a database trigger

### 4. Database trigger

Auto-update `sponsorship_raised` on `sponsorship_pets` when donations are inserted, and auto-set `sponsorship_status` based on raised vs goal.

### 5. New page: `src/pages/HelpOvercomePage.tsx`

Section-based layout (not a feed):

**Section 1 — Hero/Introduction**
- Title: "Help a Pet Overcome"
- Purpose explanation: what sponsorship means, how funds are used (vet care, food, shelter, treatment)
- Admin badge indicator (like HelpBehavePage)

**Section 2 — How Sponsorship Works**
- 3-column icon cards: "Choose a Pet" → "Sponsor" → "Pet Gets Care"
- Explains benefits: medical care, food, extra vet attention

**Section 3 — Pets Available for Sponsorship**
- Card grid layout, each card shows:
  - Pet photo
  - Name, species (Dog/Cat badge)
  - Short description/condition
  - Progress bar (raised / goal)
  - Status badge (Sponsored / Partially / Not Sponsored)
  - "Sponsor Now" button
- Filter tabs: All / Dogs / Cats

**Section 4 — Sponsor Dialog (on "Sponsor Now" click)**
- Dialog/modal with:
  - Pet info summary
  - Amount selection (preset buttons: $10, $25, $50, $100 + custom)
  - Name, email fields
  - Optional message
  - Submit button (records donation in DB, updates raised amount)
  - Note: actual payment integration is ledger-only for now (matching existing wallet pattern)

### 6. Admin controls (inline, matching existing pattern)

- "Add Pet" button visible to admins at top of listings section
- Each pet card shows Edit/Delete buttons for admins
- **Add Pet Dialog**: name, species, description, condition, photo upload (to `behave-media` bucket), goal amount
- **Edit Pet Dialog**: pre-filled form, can update status, details, goal
- **Delete**: confirmation dialog

### 7. Route update in `App.tsx`

Replace the placeholder route:
```
<Route path="/help-overcome" element={<HelpOvercomePage />} />
```

### Files to create/modify

| File | Action |
|---|---|
| `supabase/migrations/...` | Create tables, RLS, trigger |
| `src/lib/overcome-api.ts` | New API layer |
| `src/pages/HelpOvercomePage.tsx` | New page component |
| `src/App.tsx` | Update route import |

### Technical Details
- Admin check: `role === "admin"` from `useAuth()` (existing pattern)
- Photo uploads use existing `behave-media` storage bucket
- Donation flow is ledger-only (no Stripe yet), matching the wallet system pattern
- Progress bar calculated as `(raised / goal) * 100`
- Trigger function updates `sponsorship_status` automatically: goal reached = `sponsored`, partial = `partially_sponsored`

