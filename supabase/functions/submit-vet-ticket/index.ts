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
      estimate_url, attestation_url, notes,
    } = body || {};

    if (!pet_id || !clinic_name || !estimate_amount || Number(estimate_amount) <= 0) {
      return new Response(JSON.stringify({ error: "pet_id, clinic_name, estimate_amount required" }),
        { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Defense in depth: only pet owners may submit tickets.
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("pet_owner") && (roleSet.has("vet") || roleSet.has("admin"))) {
      return new Response(JSON.stringify({ error: "Only pet owners can submit vet tickets" }),
        { status: 403, headers: corsHeaders });
    }

    // Verify pet ownership
    const { data: pet } = await admin.from("pets").select("id, owner_id").eq("id", pet_id).maybeSingle();
    if (!pet || pet.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Pet not found or not yours" }), { status: 403, headers: corsHeaders });
    }

    // Find active membership for this user
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

    // Auto-approve gate: small tickets with an attestation, active membership, no reserve needed.
    let autoApproved = false;
    try {
      const { data: settings } = await admin
        .from("referral_program_settings")
        .select("auto_approve_ticket_threshold")
        .limit(1).maybeSingle();
      const threshold = Number((settings as any)?.auto_approve_ticket_threshold ?? 500);
      const hasAttestation = !!attestation_url;
      const hasActiveMembership = !!membership?.id;
      if (hasAttestation && hasActiveMembership && Number(estimate_amount) <= threshold) {
        // Compute coverage server-side via the same admin client.
        const coverageRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/compute-ticket-coverage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({ ticket_id: ticket.id, use_reserve: false }),
        });
        const coverageJson = await coverageRes.json().catch(() => ({}));
        const breakdown = coverageJson?.breakdown;
        if (breakdown) {
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
        }
      }
    } catch (e) {
      console.error("auto-approve attempt failed (ticket stays in admin review):", e);
    }

    return new Response(JSON.stringify({ ticket, auto_approved: autoApproved }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("submit-vet-ticket error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
