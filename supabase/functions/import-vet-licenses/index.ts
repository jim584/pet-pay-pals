// Admin-triggered import of one state's veterinarian license data.
// Accepts either an uploaded file (storage path) or a configured API/bulk URL.
// Supports `dry_run` so the admin console can preview kept vs filtered rows
// before committing anything to the database.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { runImport, type SourceRow } from "../_shared/vet-license-import.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: {
    state_code?: string;
    file_path?: string | null;
    source_url?: string | null;
    file_format?: string | null;
    dry_run?: boolean;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const stateCode = (body.state_code ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return json({ error: "state_code must be a 2-letter code" }, 400);

  const { data: source, error } = await admin
    .from("vet_license_sources")
    .select("state_code, state_name, authority, import_method, source_url, file_format, is_full_snapshot, mapping")
    .eq("state_code", stateCode)
    .maybeSingle();
  if (error || !source) return json({ error: "state_not_configured" }, 404);

  const summary = await runImport(admin, source as SourceRow, {
    filePath: body.file_path ?? null,
    sourceUrl: body.source_url ?? null,
    fileFormat: (body.file_format as never) ?? null,
    dryRun: body.dry_run === true,
    triggerSource: "admin",
    triggeredBy: user.id,
  });

  return json(summary, summary.status === "failed" ? 422 : 200);
});
