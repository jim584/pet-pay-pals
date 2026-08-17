// Scheduled refresh of the veterinarian license database.
// Iterates every state whose source has automatic sync enabled and whose data
// is older than its configured cadence, then runs the shared importer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { runImport, type SourceRow } from "../_shared/vet-license-import.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let force = false;
  let only: string | null = null;
  try {
    const body = await req.json();
    force = body?.force === true;
    only = body?.state_code ? String(body.state_code).toUpperCase() : null;
  } catch { /* cron sends a minimal body */ }

  let query = admin
    .from("vet_license_sources")
    .select("state_code, state_name, authority, import_method, source_url, file_format, is_full_snapshot, mapping, refresh_cadence_days, last_success_at")
    .eq("auto_sync_enabled", true)
    .in("import_method", ["api", "bulk_file"]);
  if (only) query = query.eq("state_code", only);

  const { data: sources, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const due = (sources ?? []).filter((s) => {
    if (force) return true;
    if (!s.last_success_at) return true;
    const ageDays = (now - new Date(s.last_success_at).getTime()) / 86_400_000;
    return ageDays >= (s.refresh_cadence_days ?? 7);
  });

  const results = [];
  for (const s of due) {
    const summary = await runImport(admin, s as SourceRow, { triggerSource: "cron" });
    results.push({
      state: summary.state_code,
      status: summary.status,
      kept: summary.rows_kept,
      inserted: summary.rows_inserted,
      updated: summary.rows_updated,
      deactivated: summary.rows_deactivated,
      error: summary.error_message ?? null,
    });
  }

  return json({ checked: sources?.length ?? 0, ran: results.length, results });
});
