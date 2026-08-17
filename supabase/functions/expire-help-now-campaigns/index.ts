import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 200;
const LEASE_KEY = "help_now_expiry_job";
const LEASE_MS = 10 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();

    // Single-flight lease: a second concurrent run exits instead of double-sweeping.
    const { data: lease } = await admin
      .from("platform_settings").select("value").eq("key", LEASE_KEY).maybeSingle();
    const heldUntil = (lease?.value as any)?.held_until;
    if (heldUntil && new Date(heldUntil).getTime() > now) {
      return json({ ok: true, skipped: "another run holds the lease" });
    }
    await admin.from("platform_settings")
      .update({ value: { held_until: new Date(now + LEASE_MS).toISOString() } })
      .eq("key", LEASE_KEY);

    // Only estimate-backed, published campaigns whose clock is running can expire.
    const { data: due, error } = await admin
      .from("help_now_campaigns")
      .select("id")
      .eq("status", "published")
      .eq("document_basis", "estimate")
      .is("clock_paused_at", null)
      .is("clock_paused_at", null)
      .not("expires_at", "is", null)
      .lt("expires_at", new Date(now).toISOString())
      .limit(BATCH_SIZE);
    if (error) throw error;

    const ids = (due ?? []).map((c: any) => c.id);
    if (ids.length > 0) {
      // Re-assert the guard conditions on write so the update stays idempotent.
      const { error: updErr } = await admin.from("help_now_campaigns")
        .update({ status: "expired" })
        .in("id", ids)
        .eq("status", "published");
      if (updErr) throw updErr;
    }

    await admin.from("platform_settings")
      .update({ value: { last_run_at: new Date().toISOString(), expired: ids.length } })
      .eq("key", LEASE_KEY);

    return json({ ok: true, expired: ids.length, more: ids.length === BATCH_SIZE });
  } catch (e) {
    console.error("expire-help-now-campaigns error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
