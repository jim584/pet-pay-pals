import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

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

const SENDER_DOMAIN = "notify.plexaihub.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const siteUrl = typeof body?.site_url === "string" ? body.site_url.replace(/\/$/, "") : "";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: vp } = await admin
      .from("vet_profiles")
      .select("id, clinic_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!vp) return json({ error: "No veterinarian profile found for this account" }, 404);

    const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: tokErr } = await admin.from("vet_identity_tokens").insert({
      vet_profile_id: vp.id,
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (tokErr) throw tokErr;

    const link = `${siteUrl}/vet-identity/${rawToken}`;

    if (Deno.env.get("EMAILS_ENABLED") !== "true") {
      console.log("Emails disabled — identity link not sent", { vet_profile_id: vp.id });
      return json({ ok: true, link, emailed: false, expires_at: expiresAt });
    }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1B2A4A;line-height:1.6">
        <h2 style="color:#1B2A4A">Finish your Help A Pet identity photo</h2>
        <p>Open this link on your phone to take the live identity photo required to activate your veterinarian account.</p>
        <p><a href="${link}" style="background:#D4A843;color:#1B2A4A;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Take my identity photo</a></p>
        <p style="font-size:12px;color:#555">This secure link can be used once and expires in 1 hour.</p>
      </div>`;

    await sendLovableEmail({
      from: `Help A Pet <verification@${SENDER_DOMAIN}>`,
      to: [user.email!],
      subject: "Help A Pet: take your identity photo",
      html,
    });

    return json({ ok: true, link, emailed: true, expires_at: expiresAt });
  } catch (e) {
    console.error("send-vet-identity-link error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
