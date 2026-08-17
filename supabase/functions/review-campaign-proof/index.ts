import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "Admins only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id ?? "");
    const decision = String(body?.decision ?? "");
    const reason = body?.reason ? String(body.reason).trim() : null;
    if (!campaignId) return json({ error: "campaign_id required" }, 400);
    if (!["verify", "reject", "flag"].includes(decision)) {
      return json({ error: "decision must be 'verify', 'reject' or 'flag'" }, 400);
    }
    if ((decision === "reject" || decision === "flag") && !reason) {
      return json({ error: "A reason is required" }, 400);
    }

    const { data: campaign } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.proof_of_payment_status !== "submitted") {
      return json({ error: "There is no proof of payment awaiting review" }, 400);
    }

    const now = new Date().toISOString();
    const status = decision === "verify" ? "verified" : decision === "reject" ? "rejected" : "flagged";

    const { error } = await admin.from("help_now_campaigns")
      .update({
        proof_of_payment_status: status,
        proof_reviewed_at: now,
        proof_reviewed_by: userId,
        proof_rejection_reason: decision === "verify" ? null : reason,
      })
      .eq("id", campaignId);
    if (error) throw error;

    await admin.from("campaign_disbursement_documents")
      .update({ review_status: status, reviewed_at: now, reviewed_by: userId, reason })
      .eq("campaign_id", campaignId)
      .eq("doc_type", "proof_of_payment")
      .eq("review_status", "submitted");

    await recomputeDisbursementEligibility(admin, campaignId);

    const { data: fresh } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();
    return json({ ok: true, campaign: fresh });
  } catch (e) {
    console.error("review-campaign-proof error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
