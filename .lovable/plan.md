## Goal

Stop the platform from sending ANY emails (BNPL reminders, auth emails like password reset / magic link / signup confirmation, etc.) until the DNS delegation for `notify.plexaihub.com` finishes verifying. Once DNS is live, flip a single switch to re-enable everything — no code changes needed.

## Why

The sender domain `notify.plexaihub.com` is still **Pending** DNS verification. Any email send right now will either fail or hurt sender reputation on the new subdomain. The two Edge Functions that actually call the email API are:

- `supabase/functions/send-bnpl-reminder/index.ts` — BNPL upcoming/due/missed/default reminders
- `supabase/functions/auth-email-hook/index.ts` — all Supabase Auth emails (signup, recovery, magic link, etc.)

Both use `sendLovableEmail(...)` directly.

## Approach

Introduce a single environment flag `EMAILS_ENABLED` that both functions read at the top of their handler. When it is anything other than `"true"`, the function:

1. Logs a short "emails disabled — skipping send" line (with installment_id / email_action_type for traceability).
2. Returns a successful response so callers (cron jobs, Supabase Auth) don't error or retry.
3. Skips DB side-effects that imply the email was actually delivered (specifically the `last_reminded_at` / `reminder_stage` update in `send-bnpl-reminder` — otherwise we'd mark a reminder "sent" that never went out).

Default behavior when the env var is missing = **disabled** (fail-safe). Set `EMAILS_ENABLED=true` once DNS verifies to turn sending back on.

### Files to change

1. **`supabase/functions/send-bnpl-reminder/index.ts`** — add the gate near the top of `Deno.serve`, before any work, return `{ ok: true, skipped: "emails_disabled" }`.
2. **`supabase/functions/auth-email-hook/index.ts`** — add the gate at the top of the handler. Return a 200 with an empty/no-op body so Supabase Auth treats the hook as successful and the user signup / password reset flow doesn't break in the UI. (Side effect: users won't get the email until you flip the switch — that is the intent.)

### Deployment

- Deploy both updated edge functions.
- Add the secret `EMAILS_ENABLED` (initial value: leave unset, or set to `false`).
- When DNS for `notify.plexaihub.com` shows verified in Cloud → Emails, set `EMAILS_ENABLED=true` and redeploy is NOT needed (env reads on each invocation).

## Out of scope

- No template changes.
- Not disabling Lovable Emails at the platform level (that would also affect future auth customization). The env-flag approach is reversible with one secret update.
- Not removing call sites in `src/lib/*` — those still run, the edge function just no-ops.

## Verification after applying

- Trigger a BNPL reminder (admin "process overdue" action) → function logs "skipped: emails_disabled", no email sent, `last_reminded_at` NOT updated.
- Trigger a password reset from `/auth` → no email arrives, but the auth flow returns success in the UI.
- Once DNS verifies and `EMAILS_ENABLED=true` is set, repeat both → emails arrive normally.
