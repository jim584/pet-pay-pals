import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

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

const SENDER_DOMAIN = "notify.plexaihub.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const clinicEmail = typeof body?.clinic_email === "string" ? body.clinic_email.trim() : "";
    const petId = typeof body?.pet_id === "string" ? body.pet_id : null;
    const vetProfileId = typeof body?.vet_profile_id === "string" ? body.vet_profile_id : null;
    const prefill = (body?.prefill ?? {}) as Record<string, unknown>;
    const siteUrl = typeof body?.site_url === "string" ? body.site_url.replace(/\/$/, "") : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clinicEmail)) return json({ error: "A valid clinic email is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (petId) {
      const { data: pet } = await admin.from("pets").select("id, owner_id, name").eq("id", petId).maybeSingle();
      if (!pet || pet.owner_id !== userId) return json({ error: "Pet not found or not yours" }, 403);
    }

    const { data: att, error: attErr } = await admin.from("vet_attestations").insert({
      owner_id: userId,
      pet_id: petId,
      vet_profile_id: vetProfileId,
      pet_name: (prefill.pet_name as string) ?? null,
      pet_type: (prefill.pet_type as string) ?? null,
      breed: (prefill.breed as string) ?? null,
      clinic_name: (prefill.clinic_name as string) ?? null,
      method: "emailed_link",
      status: "draft",
      answers: {},
    }).select().single();
    if (attErr) throw attErr;

    const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: tokErr } = await admin.from("attestation_link_tokens").insert({
      attestation_id: att.id,
      token_hash: tokenHash,
      clinic_email: clinicEmail,
      created_by: userId,
      expires_at: expiresAt,
    });
    if (tokErr) throw tokErr;

    const link = `${siteUrl}/attestation/${rawToken}`;

    const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
    const memberName = profile?.full_name ?? "A Help A Pet member";
    const petName = (prefill.pet_name as string) ?? "their pet";

    if (Deno.env.get("EMAILS_ENABLED") !== "true") {
      console.log("Emails disabled — attestation link not sent", { attestation_id: att.id });
      return json({ ok: true, attestation_id: att.id, link, emailed: false });
    }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1B2A4A;line-height:1.6">
        <h2 style="color:#1B2A4A">Veterinarian Attestation request</h2>
        <p>${memberName} has asked you to complete the Help A Pet veterinarian attestation for ${petName}.</p>
        <p>The form takes a few minutes. Please type the answers where possible, then sign by typing your full legal name and the date.</p>
        <p><a href="${link}" style="background:#D4A843;color:#1B2A4A;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Open the attestation form</a></p>
        <p style="font-size:12px;color:#555">This secure link can be used once and expires on ${new Date(expiresAt).toLocaleDateString()}.</p>
      </div>`;

    await sendLovableEmail({
      from: `Help A Pet <attestations@${SENDER_DOMAIN}>`,
      to: [clinicEmail],
      subject: `Help A Pet: veterinarian attestation for ${petName}`,
      html,
    });

    return json({ ok: true, attestation_id: att.id, link, emailed: true });
  } catch (e) {
    console.error("send-attestation-request error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
