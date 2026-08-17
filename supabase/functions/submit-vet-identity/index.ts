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

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_BYTES = 6 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const photo = typeof body?.photo_base64 === "string" ? body.photo_base64 : "";
    const rawToken = typeof body?.token === "string" ? body.token.trim() : "";

    const base64 = photo.includes(",") ? photo.split(",")[1] : photo;
    if (!base64 || base64.length < 100) return json({ error: "A captured photo is required" }, 400);

    let bytes: Uint8Array;
    try {
      const bin = atob(base64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return json({ error: "Photo could not be decoded" }, 400);
    }
    if (bytes.length > MAX_BYTES) return json({ error: "Photo is too large (max 6MB)" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    let vetProfileId: string | null = null;
    let tokenRowId: string | null = null;

    if (rawToken) {
      const hash = await sha256(rawToken);
      const { data: tok } = await admin
        .from("vet_identity_tokens")
        .select("id, user_id, vet_profile_id, expires_at, used_at")
        .eq("token_hash", hash)
        .maybeSingle();
      if (!tok) return json({ error: "This link is not valid" }, 404);
      if (tok.used_at) return json({ error: "This link has already been used" }, 410);
      if (new Date(tok.expires_at).getTime() < Date.now()) return json({ error: "This link has expired" }, 410);
      userId = tok.user_id;
      vetProfileId = tok.vet_profile_id;
      tokenRowId = tok.id;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      userId = userData.user.id;
      const { data: vp } = await admin
        .from("vet_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!vp) return json({ error: "No veterinarian profile found for this account" }, 404);
      vetProfileId = vp.id;
    }

    const path = `${userId}/identity-${Date.now()}.jpg`;
    const { error: upErr } = await admin.storage
      .from("vet-identity")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw upErr;

    const { error: updErr } = await admin
      .from("vet_profiles")
      .update({
        identity_photo_path: path,
        identity_photo_captured_at: new Date().toISOString(),
        account_status: "pending_verification",
        account_rejection_reason: null,
      })
      .eq("id", vetProfileId);
    if (updErr) throw updErr;

    if (tokenRowId) {
      await admin.from("vet_identity_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRowId);
    }

    return json({ ok: true, status: "pending_verification" });
  } catch (e) {
    console.error("submit-vet-identity error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
