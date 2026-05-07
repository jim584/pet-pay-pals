import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DP_WINDOW_MONTHS: Record<string, number | null> = {
  bronze: 12, silver: 24, gold: 36, platinum: null,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRow ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    const { ticket_id, breakdown, admin_notes } = await req.json();
    if (!ticket_id || !breakdown) {
      return new Response(JSON.stringify({ error: "ticket_id and breakdown required" }), { status: 400, headers: corsHeaders });
    }

    const { data: ticket } = await admin.from("vet_tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });
    }
    if (!["submitted","under_review"].includes(ticket.status)) {
      return new Response(JSON.stringify({ error: `Ticket already ${ticket.status}` }), { status: 400, headers: corsHeaders });
    }

    const dpUse = Number(breakdown.dp_use ?? 0);
    const bnplUse = Number(breakdown.bnpl_use ?? 0);
    const reserveUse = Number(breakdown.reserve_use ?? 0);
    const memberRemainder = Number(breakdown.member_remainder ?? 0);
    const approvedAmount = +(dpUse + bnplUse + reserveUse + memberRemainder).toFixed(2);

    // Determine DP window from plan
    let windowMonths: number | null = null;
    if (ticket.membership_id) {
      const { data: m } = await admin.from("memberships")
        .select("plan:membership_plans(tier, dp_window_months)").eq("id", ticket.membership_id).maybeSingle();
      const tier = (m as any)?.plan?.tier ?? "bronze";
      windowMonths = (m as any)?.plan?.dp_window_months ?? DP_WINDOW_MONTHS[tier] ?? null;
    }

    // Consume DP via FIFO
    if (dpUse > 0) {
      const { data: consumed, error: cErr } = await admin.rpc("consume_dp_for_ticket", {
        _ticket_id: ticket_id, _user_id: ticket.owner_id,
        _amount: dpUse, _window_months: windowMonths,
      });
      if (cErr) throw cErr;
      if (Number(consumed) < dpUse - 0.01) {
        // rollback
        await admin.rpc("release_ticket_allocations", { _ticket_id: ticket_id });
        return new Response(JSON.stringify({ error: `DP shortfall: only ${consumed} available` }),
          { status: 400, headers: corsHeaders });
      }
    }

    // Create BNPL obligation (with plan-driven schedule)
    if (bnplUse > 0) {
      let installmentCount = 4;
      let intervalDays = 30;
      if (ticket.membership_id) {
        const { data: mp } = await admin.from("memberships")
          .select("plan:membership_plans(bnpl_default_installments, bnpl_default_interval_days)")
          .eq("id", ticket.membership_id).maybeSingle();
        const p = (mp as any)?.plan;
        if (p?.bnpl_default_installments) installmentCount = Number(p.bnpl_default_installments);
        if (p?.bnpl_default_interval_days) intervalDays = Number(p.bnpl_default_interval_days);
      }
      await admin.from("bnpl_obligations").insert({
        pet_id: ticket.pet_id, owner_id: ticket.owner_id, ticket_id,
        provider: "manual", original_amount: bnplUse, outstanding_amount: bnplUse,
        status: "pending",
        installment_count: installmentCount,
        installment_interval_days: intervalDays,
      });
    }

    const newStatus = memberRemainder > 0 ? "approved" : "funded";

    await admin.from("vet_tickets").update({
      status: newStatus,
      coverage_breakdown: breakdown,
      approved_amount: approvedAmount,
      admin_notes: admin_notes ?? null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", ticket_id);

    // If fully funded already, queue manual payout + auto-issue card
    if (newStatus === "funded" && approvedAmount > 0) {
      await admin.from("vet_payouts").insert({
        ticket_id, amount: approvedAmount, method: "manual_ach", status: "pending",
      });
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/issue-vet-card`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            ticket_id, internal_secret: Deno.env.get("INTERNAL_FUNCTION_SECRET"),
          }),
        });
      } catch (e) { console.error("auto issue-vet-card failed:", e); }
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus, approved_amount: approvedAmount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("approve-vet-ticket error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
