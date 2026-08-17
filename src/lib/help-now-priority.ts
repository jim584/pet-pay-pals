/**
 * Requirement 14 — client mirror of the Help a Pet Now priority ranking
 * framework. Kept in step with `supabase/functions/_shared/help-now-priority.ts`,
 * which is the ranking authority for server-side allocation.
 *
 * The official priority hierarchy has NOT been supplied yet. No clinical
 * criteria, scoring weights, or substitutes (donation totals, donor counts,
 * popularity) are implemented here. Until the hierarchy arrives the ranker
 * preserves the existing feed order.
 */

export type PriorityContext = "feed" | "redirection";

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
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const timeOf = (c: RankableCase) => new Date(c.published_at ?? c.created_at ?? 0).getTime();

/** Gathers the eligibility facts a ranking rule may read, for admin review. */
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
    remaining_eligible_need: round2(Math.max(0, goal - raised)),
    goal_amount: goal,
    raised_amount: raised,
    priority_rank: c.priority_rank ?? null,
    priority_source: c.priority_source ?? "unset",
    published_at: c.published_at ?? null,
    created_at: c.created_at ?? "",
  };
}

/** Placeholder for the official hierarchy. Returns null while it is undefined. */
function applyOfficialHierarchy<T extends RankableCase>(
  _cases: T[],
  _context: PriorityContext,
): T[] | null {
  return null;
}

/**
 * Orders Help a Pet Now cases. Fallback while the hierarchy is pending keeps
 * today's order (feed = newest first). An explicitly assigned `priority_rank`
 * is honoured first; lower value = higher priority, unranked cases last.
 */
export function rankHelpNowCases<T extends RankableCase>(
  cases: T[],
  context: PriorityContext = "feed",
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

/** Whether automatic ranking is live. Flips when the official rule is added. */
export const OFFICIAL_HIERARCHY_PENDING = true;
