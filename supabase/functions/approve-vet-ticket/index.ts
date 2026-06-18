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
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

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

    // Consume member Reserve (FIFO) if requested — but re-validate server-side first.
    let validatedReserveUse = 0;
    if (reserveUse > 0) {
      // 1) Re-check eligibility from membership
      let reserveEligible = false;
      if (ticket.membership_id) {
        const { data: m } = await admin
          .from("memberships")
          .select("reserve_eligible_since, status")
          .eq("id", ticket.membership_id)
          .maybeSingle();
        reserveEligible = !!(m as any)?.reserve_eligible_since
          && ["active", "past_due"].includes((m as any)?.status);
      }
      if (!reserveEligible) {
        await admin.rpc("release_ticket_allocations", { _ticket_id: ticket_id });
        return new Response(
          JSON.stringify({ error: "Reserve not eligible: 12 months of continuous paid membership required." }),
          { status: 400, headers: corsHeaders },
        );
      }

      // 2) Re-check current available balance
      const { data: rAccruals } = await admin
        .from("member_reserve_accruals")
        .select("remaining_amount")
        .eq("user_id", ticket.owner_id);
      const reserveAvailable = (rAccruals ?? [])
        .reduce((s: number, r: any) => s + Number(r.remaining_amount ?? 0), 0);

      // 3) Cap requested amount at available balance
      validatedReserveUse = Math.min(reserveUse, reserveAvailable);
      if (validatedReserveUse <= 0) {
        await admin.rpc("release_ticket_allocations", { _ticket_id: ticket_id });
        return new Response(
          JSON.stringify({ error: "Reserve has no available balance." }),
          { status: 400, headers: corsHeaders },
        );
      }

      // 4) Consume FIFO
      const { data: rConsumed, error: rErr } = await admin.rpc("consume_reserve_for_ticket", {
        _ticket_id: ticket_id, _user_id: ticket.owner_id, _amount: validatedReserveUse,
      });
      if (rErr) throw rErr;
      if (Number(rConsumed) < validatedReserveUse - 0.01) {
        await admin.rpc("release_ticket_allocations", { _ticket_id: ticket_id });
        await admin.rpc("release_reserve_for_ticket", { _ticket_id: ticket_id });
        return new Response(JSON.stringify({ error: `Reserve shortfall: only ${rConsumed} available` }),
          { status: 400, headers: corsHeaders });
      }
    }

    // If we capped the reserve use below what was requested, push the difference into member_remainder
    // and rewrite the breakdown so downstream funding/approval reflects reality.
    const finalReserveUse = validatedReserveUse;
    const reserveDelta = reserveUse - finalReserveUse;
    const finalMemberRemainder = +(memberRemainder + reserveDelta).toFixed(2);
    breakdown.reserve_use = +finalReserveUse.toFixed(2);
    breakdown.member_remainder = finalMemberRemainder;
    breakdown.reserve_validated_server_side = true;

    const finalApproved = +(dpUse + bnplUse + Number(breakdown.reserve_use ?? 0) + Number(breakdown.member_remainder ?? 0)).toFixed(2);
    const newStatus = Number(breakdown.member_remainder ?? 0) > 0 ? "approved" : "funded";

    await admin.from("vet_tickets").update({
      status: newStatus,
      coverage_breakdown: breakdown,
      approved_amount: finalApproved,
      admin_notes: admin_notes ?? null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", ticket_id);

    // If fully funded already, queue manual payout + auto-issue card
    if (newStatus === "funded" && finalApproved > 0) {
      await admin.from("vet_payouts").insert({
        ticket_id, amount: finalApproved, method: "manual_ach", status: "pending",
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

    return new Response(JSON.stringify({ ok: true, status: newStatus, approved_amount: finalApproved }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("approve-vet-ticket error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
