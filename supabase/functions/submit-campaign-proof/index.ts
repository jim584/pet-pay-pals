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

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id ?? "");
    const proofUrl = String(body?.proof_url ?? "").trim();
    const notes = body?.notes ? String(body.notes).slice(0, 1000) : null;
    if (!campaignId) return json({ error: "campaign_id required" }, 400);
    if (!proofUrl) return json({ error: "proof_url required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (campaign.owner_id !== userId && !isAdmin) return json({ error: "Forbidden" }, 403);

    // Proof of payment only makes sense once the actual invoice is verified.
    if (campaign.document_basis !== "invoice" || campaign.invoice_status !== "accepted") {
      return json({ error: "An accepted veterinary invoice is required before proof of payment" }, 400);
    }
    if (campaign.proof_of_payment_status === "submitted") {
      return json({ error: "A proof of payment is already under review" }, 400);
    }
    if (campaign.proof_of_payment_status === "verified") {
      return json({ error: "Proof of payment has already been verified" }, 400);
    }

    const now = new Date().toISOString();

    // Invoice and proof are stored as separate verification records on the same ticket.
    await admin.from("campaign_disbursement_documents").insert({
      campaign_id: campaign.id,
      ticket_id: campaign.ticket_id,
      uploaded_by: userId,
      doc_type: "proof_of_payment",
      storage_path: proofUrl,
      review_status: "submitted",
      notes,
    });

    const { data: updated, error } = await admin.from("help_now_campaigns")
      .update({
        proof_of_payment_url: proofUrl,
        proof_of_payment_status: "submitted",
        proof_submitted_at: now,
        proof_reviewed_at: null,
        proof_reviewed_by: null,
        proof_rejection_reason: null,
      })
      .eq("id", campaignId).select().single();
    if (error) throw error;

    await recomputeDisbursementEligibility(admin, campaignId);
    const { data: fresh } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();

    return json({ ok: true, campaign: fresh ?? updated });
  } catch (e) {
    console.error("submit-campaign-proof error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
