# Response to the Help A Pet Repository Audit (Aug 4, 2026)

I verified the audit's specific technical claims against the current codebase and live database rather than taking them at face value. Summary: **the report is fair and mostly accurate.** Its five "Critical" findings are real and reproducible. A few items are overstated or already partly addressed. One item it flagged is worse than it says, and I found a separate regression it missed.

---

## 1. Claims I verified as TRUE

| Audit claim | Verification |
|---|---|
| Ticket submission unconditionally auto-approves | Confirmed. `submit-vet-ticket` has three approval paths: normal, a "fallback" that approves when the coverage function refuses, and an "error fallback" that approves on exception. No path can produce a rejection. |
| A browser can write protected ticket state | Confirmed against live RLS. The `vet_tickets` INSERT policy checks only `owner_id` — nothing constrains `status`, `approved_amount`, or funding fields. The owner UPDATE policy has the same gap while a ticket is `submitted`/`under_review`. |
| BNPL debt fields are not protected | Confirmed. The "Owners toggle autopay" UPDATE policy on `bnpl_obligations` checks only `owner_id`, so a client can rewrite any column on the row, including balance and status. |
| Stripe webhook can accept unsigned payloads | Confirmed. If `STRIPE_WEBHOOK_SECRET` is unset, the handler falls back to `JSON.parse` with no signature check. In live mode that is an open money endpoint. |
| Webhook retries can be swallowed | Confirmed. A duplicate `event_id` returns 200 immediately, even if the earlier attempt was inserted as `processing` and then failed. Stripe stops retrying and the event is lost. |
| No 3D landing experience | Confirmed. No Three.js / R3F / Babylon / Spline dependency, no scene or model assets. |
| No OCR | Confirmed. No OCR library or invoice-extraction code anywhere. |
| Vet license verification not actually active | Confirmed and expected — the adapter registry is deliberately empty; every state falls through to `pending_review`. This was our agreed decision after the board probes, not an oversight. |
| No sitemap, canonical tags, or 40-domain redirect program | Confirmed. `public/` has robots.txt only. |
| Minimal testing, no CI | Confirmed. One placeholder frontend test, a handful of Deno tests, no `.github` workflows. |

## 2. Where I'd push back or add nuance

- **"Complete automated state-board verification coverage" as a deficiency.** This is not undone work — it is a documented decision. We probed the boards; roughly half sit behind WAFs or CAPTCHAs (F5, Cloudflare), and AAVSB's free page is only a link directory, not a data source. The honest position is that broad automation is not achievable without a paid vendor (AAVSB VetNet or Verifiable) or per-state Browserless work with ToS review. That decision belongs to the client, and it should be reframed as a pending business decision rather than a build gap.
- **"18% secure production readiness."** The percentage is arguable, but the underlying point stands and I would not argue it — arguing the number distracts from the fact that the five critical findings are correct.
- **Scope creep on the 3D landing page.** The audit itself notes this was communicated verbally, outside the written specs. It's a genuine expectation but it should be scoped and priced as its own item, not folded into "finishing" existing work.

## 3. Things the audit did NOT catch

- **The brand name "Four Feet Under" is mangled to "n Under™"** in both `src/App.tsx` and the Compass menu. This is a text-replacement regression from an earlier bulk edit. It's visible on the live site.

---

## Proposed path forward

Three tiers, in strict order. Tier 1 is non-negotiable before any real money moves.

### Tier 1 — Security and authority (blocks live money)
1. Lock the webhook: fail closed with 400 when the signing secret or signature is missing; make dedupe status-aware so failed events are reprocessed on retry.
2. Rewrite RLS on `vet_tickets` and `bnpl_obligations` so clients cannot write protected columns — client inserts restricted to a safe column set, all state transitions moved to server functions with column-level enforcement at the DB boundary.
3. Replace the unconditional auto-approve in `submit-vet-ticket` with a real state machine: `submitted → under_review → approved | rejected | needs_info`, no approval fallback on error.
4. Audit the community donation path so no balance can increase without a proven Stripe charge.
5. Fix the mangled "Four Feet Under" brand string.

### Tier 2 — Financial correctness
6. Append-only ledger as the single source of truth, with holds, finalization, reversal, and expiry.
7. Bind every membership, benefit, discount, and obligation to a specific pet.
8. Reconcile card settlement status values against the DB enum; complete capture/expiry/refund/dispute handling.

### Tier 3 — Scope decisions needed from the client
9. **Vet license verification** — pick a path: paid vendor, per-state Browserless (with ToS review and cost approval), or admin manual review. Nothing further can be built until this is chosen.
10. **3D landing experience** — needs a storyboard and separate scope/timeline before any build.
11. **OCR, native store, Four Feet Under content, 40-domain SEO, CI/CD and monitoring** — each is a distinct deliverable that should be scheduled explicitly.

---

## What I need from you

- Do you want me to start Tier 1 immediately? It is the smallest, highest-value block and it directly answers the audit's five critical findings.
- Should I produce a written point-by-point reply to the client's report (confirming what's accurate, correcting what isn't, and attaching this remediation sequence)?
- The Tier 3 items are scope and budget decisions, not engineering ones — do you want to take those to the client before or after Tier 1 lands?
