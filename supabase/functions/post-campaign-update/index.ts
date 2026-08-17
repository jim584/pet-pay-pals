import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { MIN_UPDATE_LENGTH, recomputeUpdateCadence, type UpdateKind } from "../_shared/campaign-updates.ts";
import { recomputeDisbursementEligibility } from "../_shared/disbursement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const KINDS: UpdateKind[] = ["initial", "treatment", "progress"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id ?? "");
    const kind = String(body?.kind ?? "progress") as UpdateKind;
    const text = String(body?.body ?? "").trim();
    const photos: string[] = Array.isArray(body?.photo_urls)
      ? body.photo_urls.filter((p: unknown) => typeof p === "string").slice(0, 6)
      : [];

    if (!campaignId) return json({ error: "campaign_id required" }, 400);
    if (!KINDS.includes(kind)) return json({ error: "Invalid update type" }, 400);
    if (text.length < MIN_UPDATE_LENGTH) {
      return json({ error: `Write at least ${MIN_UPDATE_LENGTH} characters so the community can follow along` }, 400);
    }
    // The initial story and the treatment update both need a photo of the pet.
    if ((kind === "initial" || kind === "treatment") && photos.length === 0) {
      return json({ error: "photo_required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.owner_id !== userId) return json({ error: "Forbidden" }, 403);

    if (kind === "treatment" && campaign.invoice_status === "none") {
      return json({ error: "Upload the veterinary invoice before posting the treatment update" }, 400);
    }

    const { data: inserted, error } = await admin.from("campaign_updates").insert({
      campaign_id: campaignId,
      ticket_id: campaign.ticket_id,
      pet_id: campaign.pet_id,
      author_id: userId,
      kind,
      body: text,
      photo_urls: photos,
      is_required_update: true,
      // Reuses the platform-generated, auto-redacted verification view.
      public_verification_url: campaign.public_verification_url ?? null,
    }).select().single();
    if (error) throw error;

    await recomputeUpdateCadence(admin, campaignId);
    // Posting a missing update can immediately unblock disbursement again.
    const disbursement = await recomputeDisbursementEligibility(admin, campaignId);

    const { data: refreshed } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();

    return json({ ok: true, update: inserted, campaign: refreshed, disbursement });
  } catch (e) {
    console.error("post-campaign-update error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
