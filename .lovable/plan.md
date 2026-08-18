# Fix "Run DP expiry job" failing from the admin Reserve page

## Diagnosis (verified)

Calling the endpoint with a browser-style preflight returns `200` with **no `Access-Control-Allow-Origin` header** — the function has no CORS handling at all, so the browser blocks the call and the client reports "Failed to send a request to the Edge Function". The job itself works: the preflight actually executed the handler and returned `{"processed":0,"totalReserve":0}`.

Two more defects found in the same path:

1. **The OPTIONS preflight runs the whole job.** The handler ignores the request method, so any preflight (or any GET from anywhere) performs live expiry work.
2. **Response shape mismatch.** The function returns `{ processed, totalReserve }` but the client's `runDpExpiryJob` types it as `{ processed, reserve_added }`, so the success toast would show an undefined reserve amount.
3. **No authorization.** The function is unauthenticated and uses the service role, so anyone who knows the URL can trigger expiry and reserve redistribution.

## Fix

In `supabase/functions/process-dp-expiry/index.ts`:

- Import the shared CORS headers and return them on every response, including errors.
- Handle `OPTIONS` first and return immediately, before any database work.
- Require an authorized caller: accept either the internal cron/service secret (so the existing daily cron job keeps working) or a signed-in user who holds the `admin` role, checked server-side via the existing role function. Reject anything else with 403.
- Return `{ processed, reserve_added }` so the admin toast shows the real reserve total (keep `totalReserve` in the payload as well for the cron job's log).

In `src/lib/admin-api.ts`:

- Leave the return type as `{ processed, reserve_added }` — it will now match. No other client change needed.

## Notes

The scheduled `process-dp-expiry-daily` cron job posts to the function with the service-role key in its Authorization header, so it satisfies the new authorization check. No schema or migration changes.
