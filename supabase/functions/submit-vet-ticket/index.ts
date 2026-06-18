import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    const {
      pet_id, vet_profile_id, clinic_name, estimate_amount,
      estimate_url, attestation_url, notes, procedure_description,
    } = body || {};

    if (!pet_id || !clinic_name || !estimate_amount || Number(estimate_amount) <= 0) {
      return new Response(JSON.stringify({ error: "pet_id, clinic_name, estimate_amount required" }),
        { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("pet_owner") && (roleSet.has("vet") || roleSet.has("admin"))) {
      return new Response(JSON.stringify({ error: "Only pet owners can submit vet tickets" }),
        { status: 403, headers: corsHeaders });
    }

    const { data: pet } = await admin.from("pets").select("id, owner_id").eq("id", pet_id).maybeSingle();
    if (!pet || pet.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Pet not found or not yours" }), { status: 403, headers: corsHeaders });
    }

    const { data: membership } = await admin
      .from("memberships").select("id")
      .eq("user_id", userId).in("status", ["active","past_due"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const { data: ticket, error } = await admin.from("vet_tickets").insert({
      pet_id, owner_id: userId,
      membership_id: membership?.id ?? null,
      vet_profile_id: vet_profile_id ?? null,
      clinic_name, estimate_amount: Number(estimate_amount),
      estimate_url: estimate_url ?? null,
      attestation_url: attestation_url ?? null,
      notes: notes ?? null,
      status: "submitted",
    }).select().single();
    if (error) throw error;

    // ===== Full auto-approve checklist =====
    const blockers: string[] = [];
    let autoApproved = false;
    try {
      const { data: settings } = await admin
        .from("referral_program_settings")
        .select("auto_approve_ticket_threshold, excluded_procedures, risk_flag_thresholds")
        .limit(1).maybeSingle();
      const s: any = settings ?? {};
      const threshold = Number(s.auto_approve_ticket_threshold ?? 500);
      const excluded: string[] = s.excluded_procedures ?? [];
      const risk = s.risk_flag_thresholds ?? { tickets_per_30d: 10, pets_added_per_7d: 5, tickets_per_24h: 3 };

      // 1) attestation
      if (!attestation_url) blockers.push("missing_attestation");
      // 2) vet good standing
      if (vet_profile_id) {
        const { data: vp } = await admin.from("vet_profiles")
          .select("is_approved, is_license_verified").eq("id", vet_profile_id).maybeSingle();
        if (!vp?.is_approved || !vp?.is_license_verified) blockers.push("vet_not_in_good_standing");
      } else {
        // unknown vet → require admin review
        blockers.push("vet_profile_missing");
      }
      // 3) excluded procedure keyword match
      const haystack = `${procedure_description ?? ""} ${notes ?? ""}`.toLowerCase();
      if (excluded.some((kw) => kw && haystack.includes(String(kw).toLowerCase()))) {
        blockers.push("excluded_procedure");
      }
      // 4) threshold
      if (Number(estimate_amount) > threshold) blockers.push("over_auto_approve_threshold");
      // 5) membership
      if (!membership?.id) blockers.push("no_active_membership");
      // 7) risk flags
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d1 = new Date(now.getTime() - 86400000).toISOString();
      const [{ count: t30 }, { count: t24 }, { count: p7 }] = await Promise.all([
        admin.from("vet_tickets").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("created_at", d30),
        admin.from("vet_tickets").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("created_at", d1),
        admin.from("pets").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("created_at", d7),
      ]);
      if ((t30 ?? 0) > Number(risk.tickets_per_30d)) blockers.push("risk_tickets_per_30d");
      if ((t24 ?? 0) > Number(risk.tickets_per_24h)) blockers.push("risk_tickets_per_24h");
      if ((p7 ?? 0) > Number(risk.pets_added_per_7d)) blockers.push("risk_pets_added_per_7d");

      // 6) coverage (only meaningful when no other blockers; skip if blocked)
      if (blockers.length === 0) {
        const coverageRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/compute-ticket-coverage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": authHeader },
          body: JSON.stringify({ ticket_id: ticket.id, use_reserve: false }),
        });
        const coverageJson = await coverageRes.json().catch(() => ({}));
        const breakdown = coverageJson?.breakdown;
        const remainder = Number(breakdown?.member_remainder ?? 999);
        if (!breakdown || remainder > 0.01) {
          blockers.push("coverage_shortfall");
        } else {
          const approveRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/approve-vet-ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticket_id: ticket.id, breakdown,
              auto_approved: true,
              internal_secret: Deno.env.get("INTERNAL_FUNCTION_SECRET"),
            }),
          });
          const approveJson = await approveRes.json().catch(() => ({}));
          autoApproved = !!approveJson?.ok;
        }
      }

      if (blockers.length > 0) {
        await admin.from("vet_tickets")
          .update({ auto_approval_blockers: blockers, status: "under_review" })
          .eq("id", ticket.id);
      }
    } catch (e) {
      console.error("auto-approve attempt failed:", e);
    }

    return new Response(JSON.stringify({ ticket, auto_approved: autoApproved, blockers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("submit-vet-ticket error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
