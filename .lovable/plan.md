## Goal

Make every email the platform sends look like it comes from **Help A Pet** with a consistent sender address — no leftover `pet-pay-pals` branding.

## Current state

| Email type | From (today) | Issue |
|---|---|---|
| Auth (signup, reset, magic link, etc.) | `pet-pay-pals <noreply@plexaihub.com>` | Wrong display name; uses root domain |
| BNPL reminders (due/missed/overdue) | `Help A Pet <noreply@notify.plexaihub.com>` | Correct name; uses subdomain |

Verified domain for sending: `notify.plexaihub.com`.

## Changes

### 1. `supabase/functions/auth-email-hook/index.ts`
- `SITE_NAME = "pet-pay-pals"` → `SITE_NAME = "Help A Pet"`
- `FROM_DOMAIN = "plexaihub.com"` → `FROM_DOMAIN = "notify.plexaihub.com"` (match BNPL reminders so both come from the same address)
- `SENDER_DOMAIN` stays `notify.plexaihub.com` (the verified subdomain — must not change)

Result — recipients will see:
> **From:** Help A Pet \<noreply@notify.plexaihub.com\>

### 2. `supabase/functions/send-bnpl-reminder/index.ts`
- Already correct, no changes needed.

### 3. Deploy
- Redeploy `auth-email-hook` so the change takes effect (templates in `_shared/email-templates/*.tsx` already use `siteName` from this constant — no template edits needed).

## Out of scope
- Switching to a Help-A-Pet-owned domain (e.g. `helpapet.com`) — that requires DNS setup at a new registrar. Flag this as a future step if you want full brand alignment in the address itself.
- Email body content (already uses "Help A Pet" branding via templates).
