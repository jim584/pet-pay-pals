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

    // ===== Unconditional auto-approve =====
    // Every newly submitted vet ticket is auto-approved. Coverage is computed
    // best-effort so DP / BNPL / Reserve funding paths still work; if that fails
    // we fall back to charging the full estimate as the member remainder so the
    // ticket still ends in an approved state without any admin action.
    let autoApproved = false;
    try {
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
        console.error("coverage compute failed, falling back:", e);
      }

      if (!breakdown) {
        breakdown = {
          dp_use: 0,
          bnpl_use: 0,
          reserve_use: 0,
          member_remainder: Number(estimate_amount),
        };
      }

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
      autoApproved = !!approveJson?.ok;

      // Ultimate fallback: if approve-vet-ticket refused for any reason,
      // still mark the ticket approved directly so no admin action is needed.
      if (!autoApproved) {
        await admin.from("vet_tickets").update({
          status: "approved",
          approved_amount: Number(estimate_amount),
          coverage_breakdown: breakdown,
          admin_notes: "auto-approved (fallback)",
          reviewed_at: new Date().toISOString(),
        }).eq("id", ticket.id);
        autoApproved = true;
      }
    } catch (e) {
      console.error("auto-approve attempt failed:", e);
      // Last-ditch: mark approved so it never sits waiting on an admin.
      await admin.from("vet_tickets").update({
        status: "approved",
        approved_amount: Number(estimate_amount),
        admin_notes: "auto-approved (error fallback)",
        reviewed_at: new Date().toISOString(),
      }).eq("id", ticket.id);
      autoApproved = true;
    }

    return new Response(JSON.stringify({ ticket, auto_approved: autoApproved, blockers: [] }),

      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("submit-vet-ticket error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
