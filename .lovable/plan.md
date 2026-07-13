# Move CA to manual review + probe remaining Phase 1 boards

## Part A — Move CA to manual review (mirrors MI)

1. `supabase/functions/verify-vet-license/states/boards.ts`
   - Change CA's `technique` from `"adapter"` to `"manual"`.
   - Add `disabled_reason: "California licensing portal blocks automated server-side verification."` (or an equivalent field the coverage page already surfaces).

2. `supabase/functions/verify-vet-license/states/index.ts`
   - Remove `CA` from the `REGISTRY`. `SUPPORTED_STATES` is derived from `REGISTRY`, so CA drops out automatically.
   - Keep the `import { lookup as ca } from "./ca.ts"` line **removed** so the adapter isn't wired, but leave `ca.ts` and the `ca-active.example.html` placeholder file in place for future use.

3. Seed a disabled feature-flag row so the intent is explicit in the database:
   ```sql
   INSERT INTO public.verification_state_flags (state_code, enabled, disabled_reason)
   VALUES ('CA', false, 'California licensing portal blocks automated server-side verification.')
   ON CONFLICT (state_code) DO UPDATE
     SET enabled = false,
         disabled_reason = EXCLUDED.disabled_reason,
         updated_at = now();
   ```
   Even though CA is no longer in `REGISTRY`, this makes the flag visible in the admin coverage page and enforces the "disabled" state if the adapter is ever re-registered.

4. Admin coverage page: no code change needed. The `Manual review` badge + `disabled_reason` will render from the sources above.

5. Do NOT wire Browserless, do NOT retry the F5 WAF, do NOT capture a CA fixture. `ca-active.example.html` stays as-is.

6. Update `.lovable/plan.md` Phase 1 checklist:
   - Mark CA as "manual review — automated verification blocked by F5 WAF".
   - Update Browserless-required list to acknowledge CA is now a candidate but deferred pending permission / cost / reliability review.

## Part B — Connectivity probe for the remaining Phase 1 boards

One harmless GET per board from the same sandbox environment the edge function uses. Log HTTP status, content-type, response size, and whether the body looks like the real search page (heuristic: contains a form field or a known board string) vs. a WAF challenge page.

Boards to probe (unauthenticated, no license number, just the landing/search page):
- TX  — `https://vetsearch.tbvme.texas.gov/`
- FL  — `https://www.myfloridalicense.com/wl11.asp?mode=0&SID=`
- OH  — `https://elicense.ohio.gov/OH_HomePage`
- GA  — `https://verify.sos.ga.gov/verification/`
- PA  — `https://www.pals.pa.gov/`
- IL  — `https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx`
- NY  — `https://www.op.nysed.gov/verification-search`
- NC  — `https://portal.ncvmb.org/verification`

Each probe uses the same User-Agent the edge function uses (`HelpAPet-VerificationBot/1.0 (+https://prowebbuilders.com/contact)`). One request per board, spaced out, no retries.

## Part C — Report back before touching any more code

I will not pick the next state or start capturing fixtures. I'll post a table with:
- Board
- HTTP status
- Response size / content-type
- WAF or challenge markers detected (`F5`, `Cloudflare`, `Incapsula`, `hCaptcha`, etc.)
- My read: `accessible` / `blocked` / `needs-follow-up`

You choose the next Phase 1 state from the `accessible` set. TX / FL / OH / GA are the most likely candidates based on prior analysis, but I want the probe results in front of you before we commit.

## Out of scope for this turn

- Browserless integration.
- Any live license-number lookups.
- Any code changes for TX / FL / OH / GA / PA / IL / NY / NC.
- Any change to fixtures other than leaving `ca-active.example.html` where it is.
