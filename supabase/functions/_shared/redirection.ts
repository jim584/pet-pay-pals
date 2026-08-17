/**
 * Requirement 13 — donations to an estimate-based Help a Pet Now campaign that
 * expires without the required verification are never paid to the original
 * member. They are redirected to other Help a Pet Now cases that already hold
 * the required verified documentation.
 *
 * Ordering of receiving cases is delegated to the Help a Pet Now ranking
 * authority in `./help-now-priority.ts` (Requirement 14). The official
 * hierarchy is added there and nowhere else; this file only decides which
 * cases qualify to receive funds, never their order.
 */

import { rankHelpNowCases } from "./help-now-priority.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export type EligibleCase = {
  id: string;
  pet_id: string;
  title: string | null;
  published_at: string | null;
  created_at: string;
  goal_amount: number;
  raised_amount: number;
  remaining: number;
  priority_rank: number | null;
  priority_source: string;
  status?: string | null;
  invoice_status?: string | null;
  proof_of_payment_status?: string | null;
  disbursement_eligible_at?: string | null;
};

export type ProposedAllocation = {
  receiving_campaign_id: string;
  amount: number;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Ordering is delegated to the single Help a Pet Now ranking authority
 * (Requirement 14). Do not add ranking criteria here.
 */
export function orderByPriority(cases: EligibleCase[]): EligibleCase[] {
  return rankHelpNowCases(cases, "redirection");
}

/**
 * Campaigns that may receive redirected money: published, still short of their
 * verified ceiling, backed by an accepted invoice, and already cleared for
 * disbursement (verified proof of payment, or a direct payment to the vet).
 */
export async function listEligibleReceivingCases(
  admin: Admin,
  excludeCampaignId?: string,
): Promise<EligibleCase[]> {
  const { data, error } = await admin
    .from("help_now_campaigns")
    .select("id, pet_id, title, published_at, created_at, goal_amount, raised_amount, priority_rank, priority_source, status, invoice_status, proof_of_payment_status, disbursement_eligible_at")
    .eq("status", "published")
    .eq("document_basis", "invoice")
    .eq("invoice_status", "accepted")
    .not("disbursement_eligible_at", "is", null)
    .in("disbursement_path", ["direct_vet", "member_reimbursement"]);
  if (error) throw error;

  const rows: EligibleCase[] = (data ?? [])
    .filter((c: any) => c.id !== excludeCampaignId)
    .map((c: any) => ({
      id: c.id,
      pet_id: c.pet_id,
      title: c.title,
      published_at: c.published_at,
      created_at: c.created_at,
      goal_amount: num(c.goal_amount),
      raised_amount: num(c.raised_amount),
      remaining: round2(Math.max(0, num(c.goal_amount) - num(c.raised_amount))),
      priority_rank: c.priority_rank ?? null,
      priority_source: c.priority_source ?? "unset",
      status: c.status,
      invoice_status: c.invoice_status,
      proof_of_payment_status: c.proof_of_payment_status,
      disbursement_eligible_at: c.disbursement_eligible_at,
    }))
    .filter((c: EligibleCase) => c.remaining > 0);

  return orderByPriority(rows);
}

/**
 * Fills each eligible case up to its remaining need, in priority order, until
 * the redirected amount is used up. Anything left over stays unallocated and is
 * surfaced to admins rather than silently dropped.
 */
export function proposeAllocations(
  amount: number,
  cases: EligibleCase[],
): { allocations: ProposedAllocation[]; unallocated: number } {
  let remaining = round2(amount);
  const allocations: ProposedAllocation[] = [];
  for (const c of cases) {
    if (remaining <= 0) break;
    const take = round2(Math.min(c.remaining, remaining));
    if (take <= 0) continue;
    allocations.push({ receiving_campaign_id: c.id, amount: take });
    remaining = round2(remaining - take);
  }
  return { allocations, unallocated: round2(Math.max(0, remaining)) };
}

/** Total paid donations sitting on a campaign that have not yet been redirected. */
export async function heldDonationTotal(admin: Admin, campaignId: string): Promise<number> {
  const { data, error } = await admin
    .from("campaign_donations")
    .select("amount, redirected_amount")
    .eq("campaign_id", campaignId)
    .eq("status", "paid");
  if (error) throw error;
  const total = (data ?? []).reduce(
    (sum: number, d: any) => sum + Math.max(0, num(d.amount) - num(d.redirected_amount)),
    0,
  );
  return round2(total);
}

/**
 * Opens a pending redirection for an expired, unverified campaign holding money.
 * Idempotent: an existing pending redirection is refreshed rather than duplicated.
 */
export async function openPendingRedirection(
  admin: Admin,
  campaignId: string,
): Promise<{ id: string; total: number } | null> {
  const total = await heldDonationTotal(admin, campaignId);
  if (total <= 0) return null;

  const cases = await listEligibleReceivingCases(admin, campaignId);
  const { unallocated } = proposeAllocations(total, cases);

  const { data: existing } = await admin
    .from("campaign_redirections")
    .select("id")
    .eq("source_campaign_id", campaignId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    await admin.from("campaign_redirections")
      .update({ total_amount: total, unallocated_amount: unallocated })
      .eq("id", existing.id);
    return { id: existing.id, total };
  }

  const { data: created, error } = await admin
    .from("campaign_redirections")
    .insert({
      source_campaign_id: campaignId,
      total_amount: total,
      unallocated_amount: unallocated,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: created.id, total };
}
