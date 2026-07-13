// Cron target: retries vet profiles whose last verification attempt was
// `source_unavailable` and is 6h–72h old. Never runs indefinitely.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const cutoffMinAgo = new Date(Date.now() - 6 * 3600_000).toISOString();
  const cutoffMaxAgo = new Date(Date.now() - 72 * 3600_000).toISOString();

  // Profiles in pending_review whose license check needs a retry.
  const { data: rows } = await admin
    .from("vet_profiles")
    .select("id, verification_status, verification_checked_at, fear_free_verification_status, fear_free_checked_at")
    .or("verification_status.eq.pending_review,fear_free_verification_status.eq.pending_review")
    .limit(50);

  const retried: string[] = [];
  for (const r of rows ?? []) {
    if (r.verification_status === "pending_review"
        && r.verification_checked_at
        && r.verification_checked_at < cutoffMinAgo
        && r.verification_checked_at > cutoffMaxAgo) {
      await fetch(`${SUPABASE_URL}/functions/v1/verify-vet-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ vet_profile_id: r.id, triggered_by: "cron" }),
      }).catch(() => {});
      retried.push(`${r.id}:license`);
    }
    if (r.fear_free_verification_status === "pending_review"
        && r.fear_free_checked_at
        && r.fear_free_checked_at < cutoffMinAgo
        && r.fear_free_checked_at > cutoffMaxAgo) {
      await fetch(`${SUPABASE_URL}/functions/v1/verify-vet-fear-free`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ vet_profile_id: r.id }),
      }).catch(() => {});
      retried.push(`${r.id}:fear_free`);
    }
  }

  return new Response(JSON.stringify({ retried }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
