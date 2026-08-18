# Copy Project to Another Lovable Project with Own Supabase

## Goal
Make it easy for Lovable (or another user) to copy this project into a new Lovable project that uses the user's own Supabase backend instead of Lovable Cloud.

## Steps

### 1. Enable Public Remixing on this project
- Go to **Project Settings → Project → General → Public remixing** and turn it ON.
- This lets anyone with the project link create an independent copy/remix.
- Public remixing is not available on Enterprise plans or workspaces with publishing disabled.

### 2. Give Lovable the project editor link
Use this exact URL:

```text
https://lovable.dev/projects/7c0d4f8a-5184-4586-82d9-6efd0f4cd2fa
```

This is the project link that unlocks remixing once Public remixing is enabled. The published site URL (`pet-pay-pals.lovable.app`) or preview URL are not the right links for copying the codebase.

### 3. Understand what copies vs. what does not
A remix copies the **frontend code and project structure** into a new, independent project. It does NOT copy:
- Lovable Cloud database data, tables, or rows
- Lovable Cloud auth users or settings
- Edge functions, storage buckets, or secrets
- Stripe/webhook configurations
- Custom domains or publish settings

### 4. Connect the new project to your own Supabase
In the new/remixed project:
- Disconnect from Lovable Cloud (if auto-connected) or choose **Connect your own Supabase** during setup.
- Provide your own Supabase project URL and publishable (anon) key.
- Re-run the project's migrations to recreate tables, RLS policies, functions, and storage buckets.
- Re-create Edge Functions and secrets (Stripe keys, webhook secrets, etc.).

### 5. Reconfigure environment-specific settings
- Stripe live/test keys and webhook endpoints.
- Auth providers (Google OAuth, email domain, etc.).
- Storage buckets and bucket policies.
- Any custom domains or DNS records.

### 6. Optional: migrate data
If the new project needs existing data (users, pets, campaigns, etc.), export from the current Lovable Cloud database and import into the new Supabase project. This is a manual step and should be scoped separately if needed.

## Deliverable
A shareable project link plus a checklist so the copied project can be wired to the user's own Supabase backend.
