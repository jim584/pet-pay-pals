# Help a Pet Now Priority Ranking Framework

Build the framework that a priority hierarchy will plug into, without inventing any ranking criteria. Ordering behaviour stays exactly as it is today until Ryan's official hierarchy arrives.

## What this delivers

- A place on every campaign to store an assigned or calculated priority, plus the eligibility facts a ranking rule would need.
- One shared ranking function that both the campaign feed and the donation-redirection allocator call, so the official formula is added in a single place.
- An admin-only view of each case's current priority inputs, so the hierarchy can be validated against real cases before it goes live.

## What this explicitly does not do

- No clinical criteria, diagnosis weighting, species/age rules, or dollar-amount thresholds.
- No numeric scoring formula.
- No use of donation totals, donor counts, popularity, or campaign age as a stand-in for priority.
- No change to the order cases appear in for members or donors, and no priority badge in public UI.

## Priority fields on a campaign

Each Help a Pet Now campaign gains:

- **Assigned priority** — a rank an admin or the future rule can set. Empty by default.
- **Priority source** — records whether the value was set by hand, by the official rule, or not at all.
- **Priority computed at** — when the value was last set.
- **Priority inputs snapshot** — the eligibility facts captured alongside the value, so a decision can be audited later.

The facts the framework tracks per case (all already exist, and are simply gathered into one place): case ID, campaign status, verification/documentation status, whether the case is disbursement-eligible, and remaining eligible funding need.

## Ordering behaviour

A single ranking function decides case order everywhere:

```text
listPublishedCampaigns (feed)  ─┐
                                ├─► rankHelpNowCases()  ─► official hierarchy (to be supplied)
redirection allocator          ─┘                          fallback: today's order
```

Until the hierarchy is supplied, `rankHelpNowCases` returns cases in the current order — newest-first for the feed, oldest-verified-first for redirection — so nothing visibly changes. When the rules arrive, only that function changes.

The redirection allocator keeps its existing gate: a case can only receive redirected funds if it is published, has an accepted invoice, is cleared for disbursement, and still has remaining eligible need. Priority decides the order among qualifying cases, never whether a case qualifies.

## Admin visibility

The admin campaign area gains a priority column and a per-case panel showing the tracked eligibility facts and the current assigned priority, with a note that automatic ranking is pending the official hierarchy. Priority is never surfaced in the public feed.

## Technical notes

- Migration: add `priority_rank`, `priority_source`, `priority_computed_at`, and `priority_inputs` to `help_now_campaigns`; extend the existing field guard so members cannot self-assign priority (admin/service-role writes only).
- New `supabase/functions/_shared/help-now-priority.ts` exporting `collectPriorityInputs()` and `rankHelpNowCases()`. It becomes the only ranking authority.
- `supabase/functions/_shared/redirection.ts`: replace the local `orderByPriority` placeholder with a call to `rankHelpNowCases`, preserving current behaviour.
- Mirror the ranking helper for the client in `src/lib/help-now-priority.ts`, and route `listPublishedCampaigns` ordering through it.
- Update the project memory note on redirection so the interim-order pointer names the new single ranking function.
