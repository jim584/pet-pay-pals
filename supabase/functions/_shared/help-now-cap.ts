/**
 * Single source of truth for how much a Help a Pet Now campaign may still raise.
 *
 * Every donation / checkout path MUST call `remainingEligibleAmount` before
 * accepting money and reject the contribution when it returns 0 (or clamp the
 * contribution down to the returned amount). The database also enforces the cap
 * with the `enforce_help_now_funding_cap` trigger, which rejects any write where
 * raised_amount would exceed goal_amount — that trigger is the backstop, not the
 * user-facing gate.
 *
 * Invoice-based campaigns are capped by the verified veterinary expense minus
 * whatever Direct Pay, BNPL and the Reserve already covered (the goal_amount is
 * stored net of those offsets when the invoice is accepted), so the community
 * can never duplicate reimbursement for the same expense.
 */
export type CampaignCapRow = {
  status: string;
  goal_amount: number | string | null;
  raised_amount: number | string | null;
  document_basis?: string | null;
  expires_at?: string | null;
  clock_paused_at?: string | null;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function campaignIsExpired(c: CampaignCapRow): boolean {
  if (c.document_basis === "invoice") return false;
  if (c.status === "expired") return true;
  if (c.clock_paused_at) return false;
  return !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();
}

export function remainingEligibleAmount(c: CampaignCapRow): number {
  if (c.status !== "published") return 0;
  if (campaignIsExpired(c)) return 0;
  const remaining = num(c.goal_amount) - num(c.raised_amount);
  return remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
}

export function canAcceptDonation(c: CampaignCapRow, amount: number): boolean {
  return amount > 0 && amount <= remainingEligibleAmount(c);
}
