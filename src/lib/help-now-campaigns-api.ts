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
  title: string | null;
  story: string | null;
  photo_urls: string[];
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export const MIN_STORY_LENGTH = 40;

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

export type PublicCampaign = HelpNowCampaign & {
  pet?: { id: string; name: string; photo_url: string | null } | null;
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
