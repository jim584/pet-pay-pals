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
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      pet_id, vet_profile_id, clinic_name, estimate_amount,
      estimate_url, attestation_url, notes, procedure_description,
      attestation_confirmed, attestation_id,
    } = body || {};


    const amount = Number(estimate_amount);
    if (!pet_id || !clinic_name || !amount || amount <= 0) {
      return json({ error: "pet_id, clinic_name and a positive estimate_amount are required" }, 400);
    }

    // ---- Mandatory intake facts (audit finding: documents were optional) ----
    if (!estimate_url) {
      return json({ error: "An itemised estimate or invoice document is required" }, 400);
    }
    if (attestation_confirmed !== true) {
      return json({ error: "You must confirm the attestation before submitting" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("pet_owner") && (roleSet.has("vet") || roleSet.has("admin"))) {
      return json({ error: "Only pet owners can submit vet tickets" }, 403);
    }

    const { data: pet } = await admin.from("pets").select("id, owner_id").eq("id", pet_id).maybeSingle();
    if (!pet || pet.owner_id !== userId) return json({ error: "Pet not found or not yours" }, 403);

    // Benefits are pet-bound: only a membership covering THIS pet applies.
    const { data: membership } = await admin
      .from("memberships").select("id, status")
      .eq("user_id", userId).eq("pet_id", pet_id).in("status", ["active", "past_due"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    // ---- Create the ticket in the only legal entry state ----
    const { data: ticket, error } = await admin.from("vet_tickets").insert({
      pet_id,
      owner_id: userId,
      membership_id: membership?.id ?? null,
      vet_profile_id: vet_profile_id ?? null,
      clinic_name,
      estimate_amount: amount,
      estimate_url,
      attestation_url: attestation_url ?? null,
      notes: [notes, procedure_description].filter(Boolean).join("\n\n") || null,
      status: "submitted",
    }).select().single();
    if (error) throw error;

    // Link an electronically completed attestation to this ticket, if one was signed.
    if (attestation_id) {
      const { data: att } = await admin.from("vet_attestations")
        .select("id, owner_id, ticket_id, pdf_url").eq("id", attestation_id).maybeSingle();
      if (att && att.owner_id === userId && !att.ticket_id) {
        await admin.from("vet_attestations")
          .update({ ticket_id: ticket.id, pet_id }).eq("id", att.id);
        if (att.pdf_url && !attestation_url) {
          await admin.from("vet_tickets").update({ attestation_url: att.pdf_url }).eq("id", ticket.id);
        }
      }
    }


    // =====================================================================
    // Objective eligibility rules. Every failed rule is a blocker; any
    // blocker routes the ticket to human review. There is no path that
    // approves a ticket when a rule fails or when a downstream call errors.
    // =====================================================================
    const blockers: string[] = [];

    const { data: settings } = await admin
      .from("referral_program_settings")
      .select("auto_approve_ticket_threshold, excluded_procedures, risk_flag_thresholds")
      .limit(1).maybeSingle();

    const threshold = Number(settings?.auto_approve_ticket_threshold ?? 500);
    const excluded: string[] = settings?.excluded_procedures ?? [];
    const riskCfg = (settings?.risk_flag_thresholds ?? {}) as Record<string, number>;

    // Rule 1 — active membership
    if (!membership) blockers.push("no_active_membership");
    else if (membership.status !== "active") blockers.push(`membership_${membership.status}`);

    // Rule 2 — amount within the auto-approval threshold
    if (amount > threshold) blockers.push("over_auto_approval_threshold");

    // Rule 3 — excluded procedures
    const haystack = `${clinic_name} ${procedure_description ?? ""} ${notes ?? ""}`.toLowerCase();
    for (const proc of excluded) {
      if (proc && haystack.includes(String(proc).toLowerCase())) {
        blockers.push(`excluded_procedure:${proc}`);
      }
    }

    // Rule 4 — treating vet must be in good standing
    if (vet_profile_id) {
      const { data: vp } = await admin.from("vet_profiles")
        .select("is_approved, verification_status").eq("id", vet_profile_id).maybeSingle();
      if (!vp) blockers.push("vet_profile_not_found");
      else {
        if (!vp.is_approved) blockers.push("vet_not_approved");
        if (!["verified", "manual_override"].includes(vp.verification_status)) {
          blockers.push("vet_license_not_verified");
        }
      }
    } else {
      blockers.push("no_treating_vet_selected");
    }

    // Rule 5 — velocity / fraud flags
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: c24 } = await admin.from("vet_tickets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId).gte("created_at", since24h);
    if ((c24 ?? 0) > Number(riskCfg.tickets_per_24h ?? 3)) blockers.push("velocity_tickets_24h");

    const { count: c30 } = await admin.from("vet_tickets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId).gte("created_at", since30d);
    if ((c30 ?? 0) > Number(riskCfg.tickets_per_30d ?? 10)) blockers.push("velocity_tickets_30d");

    // Rule 6 — duplicate estimate for the same pet, clinic and amount
    const { count: dup } = await admin.from("vet_tickets")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", pet_id).eq("clinic_name", clinic_name)
      .eq("estimate_amount", amount).neq("id", ticket.id)
      .gte("created_at", since30d);
    if ((dup ?? 0) > 0) blockers.push("possible_duplicate_claim");

    // ---- Adjudicate ----
    if (blockers.length > 0) {
      await admin.from("vet_tickets").update({
        status: "under_review",
        auto_approval_blockers: blockers,
      }).eq("id", ticket.id);

      return json({
        ticket: { ...ticket, status: "under_review" },
        auto_approved: false,
        blockers,
        message: "Your request has been received and is being reviewed.",
      });
    }

    // All objective rules passed — compute coverage. A failure here is NOT
    // an approval; it routes to review.
    let breakdown: any = null;
    try {
      const coverageRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/compute-ticket-coverage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({ ticket_id: ticket.id, use_reserve: false }),
      });
      const coverageJson = await coverageRes.json().catch(() => ({}));
      breakdown = coverageJson?.breakdown ?? null;
    } catch (e) {
      console.error("coverage compute failed:", e);
    }

    if (!breakdown) {
      await admin.from("vet_tickets").update({
        status: "under_review",
        auto_approval_blockers: ["coverage_unavailable"],
      }).eq("id", ticket.id);
      return json({
        ticket: { ...ticket, status: "under_review" },
        auto_approved: false,
        blockers: ["coverage_unavailable"],
        message: "Your request has been received and is being reviewed.",
      });
    }

    let approved = false;
    try {
      const approveRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/approve-vet-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticket.id,
          breakdown,
          auto_approved: true,
          internal_secret: Deno.env.get("INTERNAL_FUNCTION_SECRET"),
        }),
      });
      const approveJson = await approveRes.json().catch(() => ({}));
      approved = !!approveJson?.ok;
    } catch (e) {
      console.error("approve-vet-ticket call failed:", e);
    }

    if (!approved) {
      // No approval fallback. The ticket waits for a human.
      await admin.from("vet_tickets").update({
        status: "under_review",
        auto_approval_blockers: ["approval_service_unavailable"],
      }).eq("id", ticket.id);
      return json({
        ticket: { ...ticket, status: "under_review" },
        auto_approved: false,
        blockers: ["approval_service_unavailable"],
        message: "Your request has been received and is being reviewed.",
      });
    }

    return json({ ticket, auto_approved: true, blockers: [] });
  } catch (e) {
    console.error("submit-vet-ticket error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
