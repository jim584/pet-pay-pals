import { supabase } from "@/integrations/supabase/client";
import type { HelpNowCampaign } from "@/lib/help-now-campaigns-api";

/**
 * Requirement 15 — social proof and required campaign updates.
 * Members owe an initial story, a treatment update once the invoice is in, and
 * a progress update at least every 30 days while a documented case stays live.
 */

export const UPDATE_INTERVAL_DAYS = 30;
export const MIN_UPDATE_LENGTH = 30;

export type CampaignUpdateKind = "initial" | "treatment" | "progress";

export type CampaignUpdate = {
  id: string;
  campaign_id: string;
  ticket_id: string | null;
  pet_id: string | null;
  author_id: string;
  kind: CampaignUpdateKind;
  body: string;
  photo_urls: string[];
  is_required_update: boolean;
  public_verification_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignUpdateStatus = {
  /** The next required update the member owes, if any. */
  dueKind: CampaignUpdateKind | null;
  overdue: boolean;
  paused: boolean;
  label: string;
  detail: string;
  nextDueAt: string | null;
};

export async function listCampaignUpdates(campaignId: string): Promise<CampaignUpdate[]> {
  const { data, error } = await supabase
    .from("campaign_updates")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CampaignUpdate[];
}

export async function uploadUpdatePhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `help-now-updates/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("pet-photos").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("pet-photos").getPublicUrl(path).data.publicUrl;
}

export async function postCampaignUpdate(input: {
  campaignId: string;
  kind: CampaignUpdateKind;
  body: string;
  photoUrls: string[];
}): Promise<{ update: CampaignUpdate; campaign: HelpNowCampaign }> {
  const { data, error } = await supabase.functions.invoke("post-campaign-update", {
    body: {
      campaign_id: input.campaignId,
      kind: input.kind,
      body: input.body,
      photo_urls: input.photoUrls,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { update: data.update as CampaignUpdate, campaign: data.campaign as HelpNowCampaign };
}

/** What the member owes right now, derived from the campaign's tracked state. */
export function campaignUpdateStatus(c: HelpNowCampaign | null | undefined): CampaignUpdateStatus {
  const none: CampaignUpdateStatus = {
    dueKind: null, overdue: false, paused: false, nextDueAt: null,
    label: "Updates are current", detail: "Thanks for keeping your donors in the loop.",
  };
  if (!c) return none;

  if (!c.initial_update_at && c.status === "draft") {
    return {
      dueKind: "initial", overdue: false, paused: false, nextDueAt: null,
      label: "Story post required",
      detail: "Publishing your case posts your story and pet photo as the first public update.",
    };
  }

  const invoiceStarted = c.invoice_status === "submitted" || c.invoice_status === "accepted";
  if (invoiceStarted && !c.treatment_update_at) {
    return {
      dueKind: "treatment", overdue: false, paused: true, nextDueAt: null,
      label: "Treatment update required",
      detail: "You uploaded the invoice — tell the community how the treatment went and add a current photo. Further funds are held until you do.",
    };
  }

  if (c.update_overdue) {
    return {
      dueKind: "progress", overdue: true, paused: true, nextDueAt: c.next_update_due_at,
      label: `${UPDATE_INTERVAL_DAYS}-day update overdue`,
      detail: "Your case stays open, but further payouts are paused until you post an update.",
    };
  }

  if (c.next_update_due_at) {
    return {
      dueKind: null, overdue: false, paused: false, nextDueAt: c.next_update_due_at,
      label: "Next update due " + new Date(c.next_update_due_at).toLocaleDateString(),
      detail: `While your case is live you post an update at least every ${UPDATE_INTERVAL_DAYS} days.`,
    };
  }

  return none;
}
