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
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

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

    return new Response(JSON.stringify({ ticket }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("submit-vet-ticket error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
