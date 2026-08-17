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

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id ?? "");
    const invoiceUrl = String(body?.invoice_url ?? "").trim();
    if (!campaignId) return json({ error: "campaign_id required" }, 400);
    if (!invoiceUrl) return json({ error: "invoice_url required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (campaign.owner_id !== userId && !isAdmin) return json({ error: "Forbidden" }, 403);

    if (campaign.document_basis === "invoice") {
      return json({ error: "This campaign already has an accepted invoice" }, 400);
    }
    if (campaign.status === "expired" || campaign.status === "cancelled") {
      return json({ error: "This campaign is no longer accepting an invoice" }, 400);
    }
    if (campaign.invoice_status === "submitted") {
      return json({ error: "An invoice is already under review" }, 400);
    }
    // A past-due campaign cannot start a new review; the sweep will expire it.
    if (campaign.expires_at && new Date(campaign.expires_at).getTime() < Date.now()) {
      return json({ error: "The 60-day estimate period has expired" }, 400);
    }

    const { data: updated, error } = await admin.from("help_now_campaigns")
      .update({
        invoice_url: invoiceUrl,
        invoice_status: "submitted",
        invoice_submitted_at: new Date().toISOString(),
        invoice_rejection_reason: null,
        invoice_reviewed_at: null,
        invoice_reviewed_by: null,
        // Pausing the clock: days spent in admin review do not count against the member.
        clock_paused_at: new Date().toISOString(),
      })
      .eq("id", campaignId).select().single();
    if (error) throw error;

    return json({ ok: true, campaign: updated });
  } catch (e) {
    console.error("submit-campaign-invoice error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
