// Requirement 15 — social proof and required campaign updates.
//
// A Help a Pet Now case cannot take funding silently. The member owes:
//   1. an initial story post (recorded when the campaign is published),
//   2. a treatment update once the actual invoice is submitted,
//   3. a progress update at least every 30 days while an invoice-verified
//      campaign is still live and receiving donations.
//
// Missing (2) or (3) pauses further disbursements — it never closes the case.

// deno-lint-ignore no-explicit-any
type Admin = any;

export const UPDATE_INTERVAL_DAYS = 30;
export const UPDATE_INTERVAL_MS = UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
export const MIN_UPDATE_LENGTH = 30;

export type UpdateKind = "initial" | "treatment" | "progress";

export type UpdateCadence = {
  initial_update_at: string | null;
  treatment_update_at: string | null;
  last_required_update_at: string | null;
  next_update_due_at: string | null;
  update_overdue: boolean;
  disbursement_paused_for_update: boolean;
  pause_reason: string | null;
};

/** Has Help a Pet already paid the clinic directly for this case? */
async function directVetSettled(admin: Admin, campaign: any): Promise<boolean> {
  if (campaign.disbursement_path === "direct_vet" && campaign.disbursement_eligible_at) return true;
  const { data } = await admin
    .from("vet_payouts")
    .select("id")
    .eq("ticket_id", campaign.ticket_id)
    .in("status", ["settled", "completed", "sent"]);
  return (data ?? []).length > 0;
}

/**
 * Recomputes the update obligations for a campaign and persists them.
 * Safe (and cheap) to call after any update, invoice or proof change.
 */
export async function recomputeUpdateCadence(
  admin: Admin,
  campaignId: string,
  nowMs = Date.now(),
): Promise<UpdateCadence | null> {
  const { data: campaign } = await admin
    .from("help_now_campaigns")
    .select("id, ticket_id, status, invoice_status, proof_of_payment_status, disbursement_path, disbursement_eligible_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return null;

  const { data: updates } = await admin
    .from("campaign_updates")
    .select("kind, created_at, is_required_update")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  const rows = (updates ?? []) as Array<{ kind: UpdateKind; created_at: string; is_required_update: boolean }>;
  const firstOf = (kind: UpdateKind) => rows.find((r) => r.kind === kind)?.created_at ?? null;

  const initialAt = firstOf("initial");
  const treatmentAt = firstOf("treatment");
  const required = rows.filter((r) => r.is_required_update);
  const lastRequiredAt = required.length ? required[required.length - 1].created_at : null;

  const treatmentDue =
    (campaign.invoice_status === "submitted" || campaign.invoice_status === "accepted") && !treatmentAt;

  const paymentDocumented =
    campaign.invoice_status === "accepted" &&
    (campaign.proof_of_payment_status === "verified" || (await directVetSettled(admin, campaign)));

  // The 30-day clock only runs while a documented campaign is still live.
  const ongoingActive = paymentDocumented && campaign.status === "published";
  const nextDueAt =
    ongoingActive && lastRequiredAt
      ? new Date(new Date(lastRequiredAt).getTime() + UPDATE_INTERVAL_MS).toISOString()
      : null;
  const overdue = !!nextDueAt && new Date(nextDueAt).getTime() < nowMs;

  const pauseReason = treatmentDue
    ? "A treatment update is required before any further funds are released"
    : overdue
      ? `This case is past due for its ${UPDATE_INTERVAL_DAYS}-day community update`
      : null;

  const cadence: UpdateCadence = {
    initial_update_at: initialAt,
    treatment_update_at: treatmentAt,
    last_required_update_at: lastRequiredAt,
    next_update_due_at: nextDueAt,
    update_overdue: overdue,
    disbursement_paused_for_update: treatmentDue || overdue,
    pause_reason: pauseReason,
  };

  await admin
    .from("help_now_campaigns")
    .update({
      initial_update_at: cadence.initial_update_at,
      treatment_update_at: cadence.treatment_update_at,
      last_required_update_at: cadence.last_required_update_at,
      next_update_due_at: cadence.next_update_due_at,
      update_overdue: cadence.update_overdue,
      disbursement_paused_for_update: cadence.disbursement_paused_for_update,
    })
    .eq("id", campaignId);

  return cadence;
}
