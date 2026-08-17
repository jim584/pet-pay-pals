// Requirement 12 — a Help a Pet Now campaign is only eligible for disbursement
// through one of two verified paths:
//   1. Help a Pet paid the veterinarian directly (settled card / vet payout).
//   2. The member already paid: accepted invoice + admin-verified proof of payment.
// An accepted invoice on its own never authorises releasing funds to the member.

import { recomputeUpdateCadence } from "./campaign-updates.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export type DisbursementResult = {
  path: "unset" | "direct_vet" | "member_reimbursement";
  eligible_at: string | null;
  block_reason: string | null;
};

/** Did Help a Pet pay the clinic directly for this ticket? */
async function hasSettledDirectVetPayment(admin: Admin, ticketId: string): Promise<boolean> {
  const { data } = await admin
    .from("vet_payouts")
    .select("id, status")
    .eq("ticket_id", ticketId)
    .in("status", ["settled", "completed", "sent"]);
  return (data ?? []).length > 0;
}

/**
 * Recomputes and persists the disbursement readiness of a campaign.
 * Safe to call after any invoice, proof-of-payment or settlement change.
 */
export async function recomputeDisbursementEligibility(
  admin: Admin,
  campaignId: string,
): Promise<DisbursementResult> {
  const { data: campaign } = await admin
    .from("help_now_campaigns")
    .select("id, ticket_id, document_basis, invoice_status, proof_of_payment_status")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) {
    return { path: "unset", eligible_at: null, block_reason: "Campaign not found" };
  }

  const now = new Date().toISOString();
  let result: DisbursementResult;

  if (await hasSettledDirectVetPayment(admin, campaign.ticket_id)) {
    result = { path: "direct_vet", eligible_at: now, block_reason: null };
  } else if (campaign.document_basis === "invoice" && campaign.invoice_status === "accepted") {
    if (campaign.proof_of_payment_status === "verified") {
      result = { path: "member_reimbursement", eligible_at: now, block_reason: null };
    } else if (campaign.proof_of_payment_status === "submitted") {
      result = { path: "unset", eligible_at: null, block_reason: "Proof of payment is under review" };
    } else if (campaign.proof_of_payment_status === "flagged") {
      result = {
        path: "unset",
        eligible_at: null,
        block_reason: "Invoice and proof of payment do not appear to match — flagged for review",
      };
    } else if (campaign.proof_of_payment_status === "rejected") {
      result = { path: "unset", eligible_at: null, block_reason: "Proof of payment was rejected" };
    } else {
      result = {
        path: "unset",
        eligible_at: null,
        block_reason: "An unpaid invoice alone does not authorise disbursement — proof of payment required",
      };
    }
  } else {
    result = {
      path: "unset",
      eligible_at: null,
      block_reason: "A verified veterinary invoice is required first",
    };
  }

  // Requirement 15: a missing required community update pauses further
  // disbursements even when the documents themselves check out.
  const cadence = await recomputeUpdateCadence(admin, campaignId);
  if (cadence?.disbursement_paused_for_update) {
    result = {
      path: result.path,
      eligible_at: null,
      block_reason: cadence.pause_reason ?? "A required campaign update is missing",
    };
  }

  // Keep an already-granted eligibility timestamp stable across recomputes.
  const { data: current } = await admin
    .from("help_now_campaigns")
    .select("disbursement_eligible_at, disbursement_path")
    .eq("id", campaignId)
    .maybeSingle();
  const eligibleAt = result.eligible_at
    ? (current?.disbursement_eligible_at ?? result.eligible_at)
    : null;

  await admin
    .from("help_now_campaigns")
    .update({
      disbursement_path: result.path,
      disbursement_eligible_at: eligibleAt,
      disbursement_block_reason: result.block_reason,
    })
    .eq("id", campaignId);

  return { ...result, eligible_at: eligibleAt };
}
