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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id ?? "");
    const decision = String(body?.decision ?? "");
    const reason = body?.reason ? String(body.reason).trim() : null;
    const verifiedAmount = body?.verified_amount === undefined || body?.verified_amount === null
      ? null : Number(body.verified_amount);
    if (!campaignId) return json({ error: "campaign_id required" }, 400);
    if (decision !== "accept" && decision !== "reject") {
      return json({ error: "decision must be 'accept' or 'reject'" }, 400);
    }
    if (decision === "reject" && !reason) return json({ error: "A rejection reason is required" }, 400);
    if (decision === "accept" && (verifiedAmount === null || !Number.isFinite(verifiedAmount) || verifiedAmount <= 0)) {
      return json({ error: "A verified invoice amount greater than zero is required" }, 400);
    }

    const { data: campaign } = await admin
      .from("help_now_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.invoice_status !== "submitted") {
      return json({ error: "There is no invoice awaiting review on this campaign" }, 400);
    }

    const now = new Date();
    const patch: Record<string, unknown> = {
      invoice_reviewed_at: now.toISOString(),
      invoice_reviewed_by: userId,
      clock_paused_at: null,
    };

    if (decision === "accept") {
      // Accepted invoice ends the estimate-only rules entirely: no 60-day clock,
      // and the goal becomes the verified vet expense minus what other funding
      // sources already covered, so the member is never reimbursed twice.
      const { data: ticket } = await admin
        .from("vet_tickets").select("coverage_breakdown").eq("id", campaign.ticket_id).maybeSingle();
      const cb = (ticket?.coverage_breakdown ?? {}) as Record<string, unknown>;
      const num = (v: unknown) => {
        const n = Number(v ?? 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const offsets = {
        dp_use: num(cb.dp_use),
        bnpl_use: num(cb.bnpl_use),
        reserve_use: num(cb.reserve_use),
      };
      const offsetTotal = offsets.dp_use + offsets.bnpl_use + offsets.reserve_use;
      const goal = Math.round(Math.max(0, verifiedAmount! - offsetTotal) * 100) / 100;
      const raised = Number(campaign.raised_amount ?? 0);

      patch.invoice_status = "accepted";
      patch.document_basis = "invoice";
      patch.verification_status = "verified";
      patch.expires_at = null;
      patch.invoice_rejection_reason = null;
      patch.verified_amount = verifiedAmount;
      patch.verified_amount_source = "admin_entered";
      patch.funding_offsets = { ...offsets, offset_total: offsetTotal, snapshot_at: now.toISOString() };
      patch.goal_amount = goal;

      if (raised >= goal) {
        // Already at or beyond the verified expense: close to new funding and
        // flag the surplus for admin follow-up instead of auto-refunding.
        patch.status = "funded";
        if (raised > goal) patch.over_raised_flagged_at = now.toISOString();
        // The cap trigger rejects raised > goal, so keep the goal at raised and
        // record the true verified ceiling separately in verified_amount.
        if (raised > goal) patch.goal_amount = raised;
      }
    } else {
      // Rejected: resume the clock, crediting back the days spent in review.
      patch.invoice_status = "rejected";
      patch.invoice_rejection_reason = reason;
      if (campaign.expires_at && campaign.clock_paused_at) {
        const paused = now.getTime() - new Date(campaign.clock_paused_at).getTime();
        patch.expires_at = new Date(new Date(campaign.expires_at).getTime() + Math.max(paused, 0)).toISOString();
      }
    }

    const { data: updated, error } = await admin.from("help_now_campaigns")
      .update(patch).eq("id", campaignId).select().single();
    if (error) throw error;

    return json({ ok: true, campaign: updated });
  } catch (e) {
    console.error("review-campaign-invoice error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
