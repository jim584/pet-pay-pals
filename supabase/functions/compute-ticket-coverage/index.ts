import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_YEAR_CAPS: Record<string, number | null> = {
  bronze: 10000, silver: 15000, gold: 20000, platinum: null,
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

    const { ticket_id, use_reserve = false } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await admin.from("vet_tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });
    }

    // Auth: owner or admin
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRow ?? []).some((r: any) => r.role === "admin");
    if (ticket.owner_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const estimate = Number(ticket.estimate_amount);

    // Membership + plan
    let plan: any = null, membership: any = null;
    if (ticket.membership_id) {
      const { data: m } = await admin.from("memberships")
        .select("*, plan:membership_plans(*)").eq("id", ticket.membership_id).maybeSingle();
      membership = m;
      plan = m?.plan;
    }

    const tier: string = plan?.tier ?? "bronze";
    const planCap = plan?.plan_cap ?? PLAN_YEAR_CAPS[tier] ?? null;
    const dpWindow = plan?.dp_window_months ?? DP_WINDOW_MONTHS[tier] ?? null;

    // Plan-year cap remaining
    let yearCapRemaining: number | null = null;
    if (planCap !== null && membership) {
      const { data: win } = await admin.rpc("get_plan_year_window", { _membership_id: membership.id });
      const yearStart = win?.[0]?.year_start;
      const yearEnd = win?.[0]?.year_end;
      if (yearStart && yearEnd) {
        const { data: usedRows } = await admin
          .from("vet_tickets")
          .select("approved_amount, status, created_at")
          .eq("owner_id", ticket.owner_id)
          .gte("created_at", yearStart).lt("created_at", yearEnd)
          .in("status", ["approved","funded","card_issued","settled"])
          .neq("id", ticket_id);
        const used = (usedRows ?? []).reduce((s: number, r: any) => s + Number(r.approved_amount ?? 0), 0);
        yearCapRemaining = Math.max(0, Number(planCap) - used);
      }
    }

    // DP available within window
    const cutoff = dpWindow === null ? "1900-01-01"
      : new Date(Date.now() - dpWindow * 30.4375 * 86400000).toISOString().slice(0, 10);
    const { data: accruals } = await admin
      .from("direct_pay_accruals")
      .select("remaining_amount, accrual_month")
      .eq("user_id", ticket.owner_id).eq("expired", false)
      .gte("accrual_month", cutoff)
      .order("accrual_month", { ascending: true });
    const dpAvailable = (accruals ?? []).reduce((s: number, r: any) => s + Number(r.remaining_amount), 0);

    // Existing BNPL outstanding for this pet (reduces capacity)
    const { data: bnplRows } = await admin
      .from("bnpl_obligations").select("outstanding_amount, status")
      .eq("pet_id", ticket.pet_id).in("status", ["pending","active"]);
    const bnplOutstanding = (bnplRows ?? []).reduce((s: number, r: any) => s + Number(r.outstanding_amount), 0);
    const concurrentObligations = (bnplRows ?? []).length;

    // Repayment history (across all pets for this owner)
    const { count: priorDefaults } = await admin
      .from("bnpl_obligations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ticket.owner_id)
      .eq("status", "defaulted");
    const sinceISO = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
    const { data: ownerObligations } = await admin
      .from("bnpl_obligations").select("id").eq("owner_id", ticket.owner_id);
    const ownerObIds = (ownerObligations ?? []).map((r: any) => r.id);
    let recentMissed = 0;
    if (ownerObIds.length) {
      const { count: missedCount } = await admin
        .from("bnpl_installments")
        .select("id", { count: "exact", head: true })
        .in("obligation_id", ownerObIds)
        .eq("status", "missed")
        .gte("due_date", sinceISO);
      recentMissed = missedCount ?? 0;
    }

    // Plan-driven BNPL capacity, with history penalty
    const bnplMultiplier = Number((plan as any)?.bnpl_multiplier ?? 0.5);
    const maxConcurrent = Number((plan as any)?.max_concurrent_obligations ?? 3);
    const defaultPenalty = Number((plan as any)?.bnpl_default_penalty ?? 0.25);
    const minMultiplier = Number((plan as any)?.bnpl_min_multiplier ?? 0);
    const penalty = Math.min(
      defaultPenalty * ((priorDefaults ?? 0) + 0.5 * recentMissed),
      bnplMultiplier,
    );
    const effectiveMultiplier = Math.max(minMultiplier, bnplMultiplier - penalty);

    // Allocation
    const cap = yearCapRemaining ?? estimate;
    const eligibleTotal = Math.min(estimate, cap);

    const dpUse = Math.min(dpAvailable, eligibleTotal);
    let remainingAfterDp = Math.max(0, eligibleTotal - dpUse);

    let bnplCapacity = 0;
    let bnplBlockedReason: string | null = null;
    if (concurrentObligations >= maxConcurrent) {
      bnplBlockedReason = "max_concurrent_reached";
    } else if (effectiveMultiplier <= 0 && (priorDefaults ?? 0) > 0) {
      bnplBlockedReason = "prior_default";
    } else {
      bnplCapacity = Math.max(0, eligibleTotal * effectiveMultiplier - bnplOutstanding);
    }
    const bnplUse = Math.min(remainingAfterDp, bnplCapacity);
    remainingAfterDp -= bnplUse;

    // Reserve eligibility placeholder (admin-controlled per ticket; default 0)
    const reserveUse = 0;

    const memberRemainder = Math.max(0, estimate - dpUse - bnplUse - reserveUse);

    const breakdown = {
      estimate, plan_tier: tier, plan_year_cap: planCap, plan_year_cap_remaining: yearCapRemaining,
      dp_window_months: dpWindow, dp_available: dpAvailable, dp_use: round2(dpUse),
      bnpl_capacity: round2(bnplCapacity), bnpl_use: round2(bnplUse), bnpl_existing_outstanding: round2(bnplOutstanding),
      bnpl_effective_multiplier: round2(effectiveMultiplier),
      bnpl_base_multiplier: bnplMultiplier,
      bnpl_prior_defaults: priorDefaults ?? 0,
      bnpl_recent_missed: recentMissed,
      bnpl_blocked_reason: bnplBlockedReason,
      reserve_use: reserveUse, member_remainder: round2(memberRemainder),
      computed_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ breakdown }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compute-ticket-coverage error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

function round2(n: number) { return Math.round(n * 100) / 100; }
