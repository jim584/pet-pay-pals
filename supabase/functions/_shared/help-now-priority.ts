/**
 * Requirement 14 — Help a Pet Now priority ranking framework.
 *
 * THIS FILE IS THE ONLY RANKING AUTHORITY. The feed ordering and the redirected
 * donation allocator both call `rankHelpNowCases`, so the official hierarchy is
 * added in exactly one place.
 *
 * The official priority criteria have NOT been supplied yet. Nothing in here
 * invents clinical criteria, scoring weights, or substitutes such as donation
 * totals, donor counts, or popularity. Until the hierarchy arrives the ranker
 * preserves each surface's existing order.
 *
 * To activate the official hierarchy later:
 *   1. Implement the rule inside `applyOfficialHierarchy` (return the ordered
 *      list, or null to keep the fallback).
 *   2. Nothing else needs to change — both call sites already route through here.
 */

export type PriorityContext = "feed" | "redirection";

/** Facts a ranking rule may read. Every field already exists on a campaign. */
export type PriorityInputs = {
  campaign_id: string;
  status: string;
  verification_status: string | null;
  document_basis: string | null;
  invoice_status: string | null;
  proof_of_payment_status: string | null;
  disbursement_eligible: boolean;
  remaining_eligible_need: number;
  goal_amount: number;
  raised_amount: number;
  priority_rank: number | null;
  priority_source: string;
  published_at: string | null;
  created_at: string;
};

export type RankableCase = {
  id: string;
  status?: string | null;
  verification_status?: string | null;
  document_basis?: string | null;
  invoice_status?: string | null;
  proof_of_payment_status?: string | null;
  disbursement_eligible_at?: string | null;
  goal_amount?: number | string | null;
  raised_amount?: number | string | null;
  priority_rank?: number | null;
  priority_source?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  remaining?: number;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const timeOf = (c: RankableCase) =>
  new Date(c.published_at ?? c.created_at ?? 0).getTime();

/** Gathers the eligibility facts for a case into one auditable snapshot. */
export function collectPriorityInputs(c: RankableCase): PriorityInputs {
  const goal = num(c.goal_amount);
  const raised = num(c.raised_amount);
  return {
    campaign_id: c.id,
    status: String(c.status ?? ""),
    verification_status: c.verification_status ?? null,
    document_basis: c.document_basis ?? null,
    invoice_status: c.invoice_status ?? null,
    proof_of_payment_status: c.proof_of_payment_status ?? null,
    disbursement_eligible: !!c.disbursement_eligible_at,
    remaining_eligible_need: c.remaining !== undefined
      ? round2(c.remaining)
      : round2(Math.max(0, goal - raised)),
    goal_amount: goal,
    raised_amount: raised,
    priority_rank: c.priority_rank ?? null,
    priority_source: c.priority_source ?? "unset",
    published_at: c.published_at ?? null,
    created_at: c.created_at ?? "",
  };
}

/**
 * Placeholder for the official Help a Pet Now priority hierarchy.
 * Returns null while the criteria are undefined, which keeps the existing
 * per-surface order. Do not invent criteria here.
 */
function applyOfficialHierarchy<T extends RankableCase>(
  _cases: T[],
  _context: PriorityContext,
): T[] | null {
  return null;
}

/**
 * Orders eligible Help a Pet Now cases.
 *
 * Fallback while the hierarchy is pending:
 *   feed        → current behaviour, newest first
 *   redirection → current behaviour, oldest verified case first
 *
 * An explicitly assigned `priority_rank` (admin or a future rule) is honoured
 * ahead of the fallback so the framework is usable the moment ranks are set.
 * Lower rank value = higher priority; unranked cases follow ranked ones.
 */
export function rankHelpNowCases<T extends RankableCase>(
  cases: T[],
  context: PriorityContext,
): T[] {
  const official = applyOfficialHierarchy(cases, context);
  if (official) return official;

  const newestFirst = context === "feed";
  return [...cases].sort((a, b) => {
    const ar = a.priority_rank ?? null;
    const br = b.priority_rank ?? null;
    if (ar !== null && br !== null && ar !== br) return ar - br;
    if (ar !== null && br === null) return -1;
    if (ar === null && br !== null) return 1;
    const diff = timeOf(a) - timeOf(b);
    return newestFirst ? -diff : diff;
  });
}
