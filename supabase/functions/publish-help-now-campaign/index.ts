import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (campaign.owner_id !== userId && !isAdmin) return json({ error: "Forbidden" }, 403);

    if (campaign.status !== "draft") return json({ error: "This campaign is already published" }, 400);
    if (Number(campaign.goal_amount) <= 0) return json({ error: "This campaign has nothing left to fund" }, 400);

    const story = String(campaign.story ?? "").trim();
    const photos: string[] = campaign.photo_urls ?? [];
    if (story.length < 40) return json({ error: "story_required" }, 400);
    if (photos.length < 1) return json({ error: "photo_required" }, 400);

    const { data: updated, error } = await admin.from("help_now_campaigns")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", campaign_id).select().single();
    if (error) throw error;

    return json({ ok: true, campaign: updated });
  } catch (e) {
    console.error("publish-help-now-campaign error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
