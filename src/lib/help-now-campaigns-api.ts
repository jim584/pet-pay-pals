import { supabase } from "@/integrations/supabase/client";

export type HelpNowCampaignStatus = "draft" | "published" | "funded" | "expired" | "cancelled";

export type HelpNowCampaign = {
  id: string;
  ticket_id: string;
  pet_id: string;
  owner_id: string;
  goal_amount: number;
  raised_amount: number;
  status: HelpNowCampaignStatus;
  verification_status: string;
  document_basis: "estimate" | "invoice";
  invoice_url: string | null;
  invoice_status: "none" | "submitted" | "accepted" | "rejected";
  invoice_submitted_at: string | null;
  invoice_reviewed_at: string | null;
  invoice_rejection_reason: string | null;
  clock_paused_at: string | null;
  verified_amount: number | null;
  verified_amount_source: string | null;
  funding_offsets: Record<string, number | string> | null;
  over_raised_flagged_at: string | null;
  disbursement_path: "unset" | "direct_vet" | "member_reimbursement";
  proof_of_payment_status: "none" | "submitted" | "verified" | "rejected" | "flagged";
  proof_of_payment_url: string | null;
  proof_submitted_at: string | null;
  proof_reviewed_at: string | null;
  proof_reviewed_by: string | null;
  proof_rejection_reason: string | null;
  disbursement_eligible_at: string | null;
  disbursement_block_reason: string | null;
  title: string | null;
  story: string | null;
  photo_urls: string[];
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};


export const MIN_STORY_LENGTH = 40;
export const ESTIMATE_WINDOW_DAYS = 60;

/**
 * Live expiry check that runs alongside the nightly sweep, so a past-due campaign
 * reads as expired the moment it is loaded. The clock only runs while the campaign
 * is still estimate-backed and no invoice is sitting in review.
 */
export function campaignClockRunning(c: HelpNowCampaign | null | undefined): boolean {
  if (!c) return false;
  return c.document_basis === "estimate" && !c.clock_paused_at && !!c.expires_at;
}

export function campaignEffectiveStatus(c: HelpNowCampaign | null | undefined): HelpNowCampaignStatus | null {
  if (!c) return null;
  if (c.status === "published" && campaignClockRunning(c) && new Date(c.expires_at!) < new Date()) {
    return "expired";
  }
  return c.status;
}

export function campaignDaysRemaining(c: HelpNowCampaign | null | undefined): number | null {
  if (!c?.expires_at || c.document_basis !== "estimate") return null;
  const ms = new Date(c.expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

/** True once an admin has accepted an actual invoice: no 60-day deadline applies. */
export function campaignIsInvoiceBased(c: HelpNowCampaign | null | undefined): boolean {
  return c?.document_basis === "invoice";
}

/**
 * How much this campaign may still raise. The goal is the verified eligible
 * veterinary amount (net of Direct Pay, BNPL and Reserve), so this is the hard
 * ceiling on further community funding.
 */
export function campaignRemainingEligible(c: HelpNowCampaign | null | undefined): number {
  if (!c) return 0;
  const remaining = Number(c.goal_amount ?? 0) - Number(c.raised_amount ?? 0);
  return remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
}

export function canDonateToCampaign(c: HelpNowCampaign | null | undefined): boolean {
  const status = campaignEffectiveStatus(c);
  if (status !== "published") return false;
  return campaignRemainingEligible(c) > 0;
}

export function campaignIsOverRaised(c: HelpNowCampaign | null | undefined): boolean {
  return !!c?.over_raised_flagged_at;
}

/* ---------------------------------------------------------------------------
 * Requirement 12 — invoice + proof of payment before disbursement.
 * An accepted invoice alone never authorises releasing funds to the member.
 * ------------------------------------------------------------------------- */

export type DisbursementState =
  | { eligible: true; path: "direct_vet" | "member_reimbursement"; label: string; detail: string }
  | { eligible: false; path: "unset"; label: string; detail: string };

export function campaignDisbursementState(c: HelpNowCampaign | null | undefined): DisbursementState {
  if (c?.disbursement_eligible_at && c.disbursement_path === "direct_vet") {
    return {
      eligible: true, path: "direct_vet",
      label: "Eligible via direct vet payment",
      detail: "Help a Pet paid the veterinarian directly for this verified expense.",
    };
  }
  if (c?.disbursement_eligible_at && c.disbursement_path === "member_reimbursement") {
    return {
      eligible: true, path: "member_reimbursement",
      label: "Eligible via verified reimbursement",
      detail: "The invoice and proof that it was paid have both been verified.",
    };
  }
  return {
    eligible: false, path: "unset",
    label: "Not eligible for disbursement",
    detail: c?.disbursement_block_reason
      ?? "A verified veterinary invoice plus proof of payment (or a direct payment to the vet) is required.",
  };
}

/** True when the member still needs to supply proof they paid the vet bill. */
export function campaignProofRequired(c: HelpNowCampaign | null | undefined): boolean {
  if (!c) return false;
  if (c.disbursement_path === "direct_vet" && c.disbursement_eligible_at) return false;
  return c.document_basis === "invoice"
    && c.invoice_status === "accepted"
    && c.proof_of_payment_status !== "verified";
}

export async function uploadCampaignProof(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${userId}/${Date.now()}-proof-of-payment.${ext}`;
  const { error } = await supabase.storage.from("vet-tickets").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function submitCampaignProof(
  campaignId: string, proofUrl: string, notes?: string,
): Promise<HelpNowCampaign> {
  const { data, error } = await supabase.functions.invoke("submit-campaign-proof", {
    body: { campaign_id: campaignId, proof_url: proofUrl, notes },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.campaign as HelpNowCampaign;
}

export async function reviewCampaignProof(
  campaignId: string, decision: "verify" | "reject" | "flag", reason?: string,
): Promise<HelpNowCampaign> {
  const { data, error } = await supabase.functions.invoke("review-campaign-proof", {
    body: { campaign_id: campaignId, decision, reason },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.campaign as HelpNowCampaign;
}

export async function listCampaignsAwaitingProofReview(): Promise<ReviewCampaign[]> {
  const { data, error } = await supabase
    .from("help_now_campaigns")
    .select("*, pet:pets(id, name, photo_url), ticket:vet_tickets(id, coverage_breakdown)")
    .eq("proof_of_payment_status", "submitted")
    .order("proof_submitted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ReviewCampaign[];
}


export function campaignReadyToPublish(c: HelpNowCampaign | null | undefined): boolean {
  if (!c) return false;
  return (c.story ?? "").trim().length >= MIN_STORY_LENGTH && (c.photo_urls ?? []).length > 0;
}

export async function getCampaignForTicket(ticketId: string): Promise<HelpNowCampaign | null> {
  const { data, error } = await supabase
    .from("help_now_campaigns").select("*").eq("ticket_id", ticketId).maybeSingle();
  if (error) throw error;
  return (data as unknown as HelpNowCampaign) ?? null;
}

export async function updateCampaignContent(
  id: string,
  patch: { title?: string | null; story?: string | null; photo_urls?: string[] },
): Promise<HelpNowCampaign> {
  const { data, error } = await supabase
    .from("help_now_campaigns").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as unknown as HelpNowCampaign;
}

export async function publishCampaign(id: string): Promise<HelpNowCampaign> {
  const { data, error } = await supabase.functions.invoke("publish-help-now-campaign", {
    body: { campaign_id: id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.campaign as HelpNowCampaign;
}

export async function uploadCampaignPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `help-now/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("pet-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadCampaignInvoice(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "pdf";
  // Private bucket; storage policies scope writes to a folder named after the user.
  const path = `${userId}/${Date.now()}-campaign-invoice.${ext}`;
  const { error } = await supabase.storage.from("vet-tickets").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getCampaignInvoiceSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("vet-tickets").createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function submitCampaignInvoice(campaignId: string, invoiceUrl: string): Promise<HelpNowCampaign> {
  const { data, error } = await supabase.functions.invoke("submit-campaign-invoice", {
    body: { campaign_id: campaignId, invoice_url: invoiceUrl },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.campaign as HelpNowCampaign;
}

export async function reviewCampaignInvoice(
  campaignId: string,
  decision: "accept" | "reject",
  opts?: { reason?: string; verifiedAmount?: number },
): Promise<HelpNowCampaign> {
  const { data, error } = await supabase.functions.invoke("review-campaign-invoice", {
    body: {
      campaign_id: campaignId,
      decision,
      reason: opts?.reason,
      verified_amount: opts?.verifiedAmount,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.campaign as HelpNowCampaign;
}

export async function listCampaignsAwaitingInvoiceReview(): Promise<ReviewCampaign[]> {
  const { data, error } = await supabase
    .from("help_now_campaigns")
    .select("*, pet:pets(id, name, photo_url), ticket:vet_tickets(id, coverage_breakdown)")
    .eq("invoice_status", "submitted")
    .order("invoice_submitted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ReviewCampaign[];
}

/** Campaigns that raised more than the accepted invoice supports — admin follow-up. */
export async function listOverRaisedCampaigns(): Promise<PublicCampaign[]> {
  const { data, error } = await supabase
    .from("help_now_campaigns")
    .select("*, pet:pets(id, name, photo_url)")
    .not("over_raised_flagged_at", "is", null)
    .order("over_raised_flagged_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PublicCampaign[];
}

/** Direct Pay / BNPL / Reserve already applied to the ticket behind a campaign. */
export function coverageOffsetTotal(c: ReviewCampaign | null | undefined): number {
  const cb = (c?.ticket?.coverage_breakdown ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return Math.round((num(cb.dp_use) + num(cb.bnpl_use) + num(cb.reserve_use)) * 100) / 100;
}

export type PublicCampaign = HelpNowCampaign & {
  pet?: { id: string; name: string; photo_url: string | null } | null;
};

export type ReviewCampaign = PublicCampaign & {
  ticket?: { id: string; coverage_breakdown: Record<string, unknown> | null } | null;
};

export async function listPublishedCampaigns(limit = 20): Promise<PublicCampaign[]> {
  const { data, error } = await supabase
    .from("help_now_campaigns")
    .select("*, pet:pets(id, name, photo_url)")
    .in("status", ["published", "funded"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PublicCampaign[];
}

export async function isReservePoolEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from("platform_settings").select("value").eq("key", "reserve_pool_enabled").maybeSingle();
  return data?.value === true || (data?.value as unknown) === "true";
}

export async function setReservePoolEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("platform_settings")
    .update({ value: enabled as any })
    .eq("key", "reserve_pool_enabled");
  if (error) throw error;
}

/* ── Requirement 13: donations and redirection ─────────────────────────── */

export type CampaignDonation = {
  id: string;
  campaign_id: string;
  donor_user_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  currency: string;
  message: string | null;
  status: string;
  paid_at: string | null;
  redirection_id: string | null;
  redirected_amount: number;
  redirected_at: string | null;
  donor_notification_status: string;
  donor_notified_at: string | null;
  created_at: string;
};

export type CampaignRedirection = {
  id: string;
  source_campaign_id: string;
  total_amount: number;
  allocated_amount: number;
  unallocated_amount: number;
  status: "pending" | "released" | "cancelled";
  reason: string;
  released_at: string | null;
  released_by: string | null;
  created_at: string;
  source?: { id: string; title: string | null; pet?: { name: string } | null } | null;
};

export type RedirectionAllocation = {
  id: string;
  redirection_id: string;
  receiving_campaign_id: string;
  amount: number;
  applied_at: string | null;
};

/**
 * Donor-facing disclosure shown before a donation is completed (Requirement 13).
 * Keep the wording in one place so every donation surface says the same thing.
 */
export const REDIRECTION_DISCLOSURE =
  "Your donation goes to this Help a Pet Now case first. If this case does not become a "
  + "verified veterinary expense — an actual invoice plus proof of payment, or a payment made "
  + "directly to the veterinarian — within the required timeframe, your donation will not be "
  + "paid out as cash to the member. It will instead be redirected to another high-priority "
  + "Help a Pet Now case that already has verified documentation, and we will tell you which "
  + "case received it.";

/** Starts a Stripe checkout for a campaign donation and returns the redirect URL. */
export async function startCampaignDonation(input: {
  campaign_id: string;
  amount: number;
  donor_name?: string;
  donor_email?: string;
  message?: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-campaign-donation-checkout", {
    body: input,
  });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? "Could not start the donation");
  return data.url as string;
}

export async function listRedirections(status?: "pending" | "released" | "cancelled") {
  let q = supabase
    .from("campaign_redirections")
    .select("*, source:help_now_campaigns!campaign_redirections_source_campaign_id_fkey(id, title, pet:pets(name))")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CampaignRedirection[];
}

export async function listRedirectionAllocations(redirectionId: string) {
  const { data, error } = await supabase
    .from("campaign_redirection_allocations")
    .select("*")
    .eq("redirection_id", redirectionId);
  if (error) throw error;
  return (data ?? []) as unknown as RedirectionAllocation[];
}

export async function listCampaignDonations(campaignId: string) {
  const { data, error } = await supabase
    .from("campaign_donations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CampaignDonation[];
}

/** Admin: preview, release, or cancel a pending redirection. */
export async function actOnRedirection(input: {
  redirection_id: string;
  action: "propose" | "release" | "cancel";
  allocations?: { receiving_campaign_id: string; amount: number }[];
}) {
  const { data, error } = await supabase.functions.invoke("release-campaign-redirection", { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as {
    ok: boolean;
    total?: number;
    allocated?: number;
    unallocated?: number;
    notified?: number;
    cases?: { id: string; title: string | null; remaining: number }[];
    allocations?: { receiving_campaign_id: string; amount: number }[];
  };
}
