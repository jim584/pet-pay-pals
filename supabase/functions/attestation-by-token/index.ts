import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token) return json({ error: "Missing token" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha256(token);
    const { data: t } = await admin.from("attestation_link_tokens")
      .select("id, attestation_id, expires_at, used_at").eq("token_hash", hash).maybeSingle();
    if (!t) return json({ error: "This link is not valid" }, 404);
    if (t.used_at) return json({ error: "This link has already been used" }, 410);
    if (new Date(t.expires_at).getTime() < Date.now()) return json({ error: "This link has expired" }, 410);

    const { data: att } = await admin.from("vet_attestations")
      .select("id, status, pet_name, pet_type, breed, clinic_name, pet_id, owner_id")
      .eq("id", t.attestation_id).maybeSingle();
    if (!att) return json({ error: "Attestation not found" }, 404);
    if (att.status === "completed") return json({ error: "This attestation is already complete" }, 410);

    const { data: profile } = await admin.from("profiles").select("full_name")
      .eq("user_id", att.owner_id).maybeSingle();

    return json({
      ok: true,
      expires_at: t.expires_at,
      member_name: profile?.full_name ?? null,
      prefill: {
        pet_name: att.pet_name ?? "",
        pet_type: att.pet_type ?? "",
        breed: att.breed ?? "",
        clinic_name: att.clinic_name ?? "",
      },
    });
  } catch (e) {
    console.error("attestation-by-token error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
