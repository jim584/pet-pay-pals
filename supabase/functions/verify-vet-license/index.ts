// Automated vet license verification.
// Dispatches to a per-state lookup module. Any state without a module
// (or a state whose source is unreachable) returns `pending_review`
// with a reason, never `unverified`, so an admin can adjudicate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { BOARDS, lookupByState, STATE_CODES, SUPPORTED_STATES } from "./states/index.ts";

interface Body { vet_profile_id: string; triggered_by?: string }

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
  if (req.method === "GET") {
    // Coverage introspection for the admin dashboard.
    return json({
      states: STATE_CODES.map((c) => ({ ...BOARDS[c], supported: SUPPORTED_STATES.includes(c) })),
      supported: SUPPORTED_STATES,
      total: STATE_CODES.length,
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body?.vet_profile_id) return json({ error: "vet_profile_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: vp, error } = await admin
    .from("vet_profiles")
    .select("id, license_number, license_state, license_full_legal_name")
    .eq("id", body.vet_profile_id)
    .maybeSingle();
  if (error || !vp) return json({ error: "profile_not_found" }, 404);

  if (!vp.license_number || !vp.license_state || !vp.license_full_legal_name) {
    await admin.from("vet_verification_attempts").insert({
      vet_profile_id: vp.id, kind: "license", status: "missing_input",
      error: "License number, state and full legal name are required",
    });
    await admin.from("vet_profiles").update({
      verification_status: "pending",
      verification_reason: "Missing license number, state, or full legal name",
      verification_checked_at: new Date().toISOString(),
    }).eq("id", vp.id);
    return json({ status: "pending", reason: "missing_input" });
  }

  const state = vp.license_state.toUpperCase();

  // Feature flag: allow admins to disable an individual state adapter without
  // touching code. Disabled → pending_review with the admin's reason (never
  // unverified), so the "source unavailable → don't reject" invariant holds.
  const { data: flag } = await admin
    .from("verification_state_flags")
    .select("enabled, disabled_reason")
    .eq("state_code", state)
    .maybeSingle();

  let result;
  if (flag && flag.enabled === false) {
    result = {
      status: "not_supported" as const,
      source: `state:${state}`,
      source_url: null,
      reason: flag.disabled_reason ?? `Automated verification for ${state} is temporarily disabled by an admin.`,
      http_status: null,
      raw: { decision: { reason_code: "adapter_disabled_by_flag", state } },
    };
  } else {
    try {
      result = await lookupByState(state, {
        licenseNumber: vp.license_number,
        fullLegalName: vp.license_full_legal_name,
      });
    } catch (e) {
      result = {
        status: "source_unavailable" as const,
        source: `state:${state}`,
        source_url: null,
        reason: `Source error: ${String((e as Error).message ?? e).slice(0, 200)}`,
        http_status: null,
        raw: { decision: { reason_code: "adapter_threw", error: String((e as Error).message ?? e).slice(0, 200) } },
      };
    }
  }

  // Map lookup result → profile status
  let vp_status: "verified" | "unverified" | "pending_review" = "pending_review";
  if (result.status === "match") vp_status = "verified";
  else if (result.status === "no_match" || result.status === "expired" || result.status === "inactive")
    vp_status = "unverified";
  else vp_status = "pending_review"; // source_unavailable, ambiguous, not_supported

  await admin.from("vet_verification_attempts").insert({
    vet_profile_id: vp.id,
    kind: "license",
    status: result.status,
    http_status: result.http_status ?? null,
    source: result.source,
    error: result.status !== "match" ? result.reason ?? null : null,
    payload: result.raw ?? null,
  });

  await admin.from("vet_profiles").update({
    verification_status: vp_status,
    verification_checked_at: new Date().toISOString(),
    verification_source: result.source,
    verification_source_url: result.source_url,
    verification_reason: result.reason ?? null,
    verification_raw: result.raw ?? null,
    // Mirror legacy boolean for existing UI/gating code
    is_license_verified: vp_status === "verified" ? true : false,
    license_verified_at: vp_status === "verified" ? new Date().toISOString() : null,
  }).eq("id", vp.id);

  return json({
    status: vp_status,
    lookup_status: result.status,
    reason: result.reason,
    source: result.source,
    supported_states: SUPPORTED_STATES,
  });
});
