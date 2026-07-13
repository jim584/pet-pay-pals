// Fear Free directory verification.
// Fear Free has no documented public API; we perform a best-effort HTTP check
// against their public "Find a Fear Free Professional" directory and fall back
// to pending_review on any inconclusive result — never unverified on source error.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body { vet_profile_id: string }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DIRECTORY_URL = "https://fearfreepets.com/directory/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body?.vet_profile_id) return json({ error: "vet_profile_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: vp, error } = await admin
    .from("vet_profiles")
    .select("id, fear_free_cert_number, license_full_legal_name")
    .eq("id", body.vet_profile_id)
    .maybeSingle();
  if (error || !vp) return json({ error: "profile_not_found" }, 404);

  if (!vp.fear_free_cert_number) {
    // Not attempting Fear Free — leave as pending, admin can override to unverified.
    return json({ status: "pending", reason: "no_cert_number" });
  }

  // Best-effort directory ping. Actual match logic requires Fear Free to expose
  // per-certificate lookup — until then we mark pending_review so an admin
  // manually confirms via the uploaded cert or by contacting Fear Free.
  let http_status: number | null = null;
  let raw: string | null = null;
  let sourceOk = false;
  try {
    const res = await fetch(DIRECTORY_URL, {
      headers: { "User-Agent": "HelpAPetVerifier/1.0 (+admin@helpapet.app)" },
    });
    http_status = res.status;
    sourceOk = res.ok;
    raw = (await res.text()).slice(0, 2000);
  } catch (e) {
    await admin.from("vet_verification_attempts").insert({
      vet_profile_id: vp.id, kind: "fear_free", status: "source_unavailable",
      source: "fearfreepets.com/directory", error: String((e as Error).message).slice(0, 200),
    });
    await admin.from("vet_profiles").update({
      fear_free_verification_status: "pending_review",
      fear_free_checked_at: new Date().toISOString(),
      fear_free_source: "fearfreepets.com/directory",
      fear_free_reason: "Directory unreachable — will retry.",
    }).eq("id", vp.id);
    return json({ status: "pending_review", reason: "source_unavailable" });
  }

  const status: "pending_review" = "pending_review";
  const reason = sourceOk
    ? "Fear Free does not expose per-certificate lookup — admin will verify uploaded certificate."
    : `Directory returned HTTP ${http_status} — will retry.`;

  await admin.from("vet_verification_attempts").insert({
    vet_profile_id: vp.id,
    kind: "fear_free",
    status: sourceOk ? "pending_review" : "source_unavailable",
    http_status,
    source: "fearfreepets.com/directory",
    error: sourceOk ? null : `HTTP ${http_status}`,
    payload: { snippet: raw },
  });

  await admin.from("vet_profiles").update({
    fear_free_verification_status: status,
    fear_free_checked_at: new Date().toISOString(),
    fear_free_source: "fearfreepets.com/directory",
    fear_free_reason: reason,
    fear_free_raw: { snippet: raw?.slice(0, 500) ?? null },
  }).eq("id", vp.id);

  return json({ status, reason });
});
