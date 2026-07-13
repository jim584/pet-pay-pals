// TEMPORARY admin-only diagnostic endpoint. Deleted immediately after one run.
//
// Purpose: measure whether each Phase 1 state licensing board is reachable
// from the deployed Supabase Edge runtime. NOT a verification endpoint —
// stores nothing in application tables, uses only a hard-coded allowlist of
// board URLs, accepts no arbitrary URL from the caller, and does not log any
// response body, cookie, header value, or PII.
//
// Auth: bearer token → admin-role check via public.has_role. Non-admins get 403.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "HelpAPet-VerificationBot/1.0 (+https://prowebbuilders.com/contact)";
const CONNECT_TIMEOUT_MS = 12_000;
const FORM_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 8 * 1024;
const HANDLER_CEILING_MS = 60_000;

const ALLOWLIST: Record<string, string> = {
  TX: "https://vetlicensesearch.tbvme.texas.gov/",
  FL: "https://www.myfloridalicense.com/wl11.asp?mode=0&SID=",
  OH: "https://elicense.ohio.gov/oh_verifylicense",
  GA: "https://verify.sos.ga.gov/verification/",
  PA: "https://www.pals.pa.gov/",
  IL: "https://ilesonline.idfpr.illinois.gov/DPR/Lookup/LicenseLookup.aspx",
  NY: "https://www.op.nysed.gov/verification-search",
  NC: "https://portal.ncvmb.org/",
};

// Form-flow probes (NY, NC). Uses obviously-invalid values so no real
// person's data is touched.
const FORM_FLOW: Record<string, { url: string; method: "GET" | "POST"; body?: string; contentType?: string }> = {
  NY: {
    // NYSED public verification search POST. Impossible last name.
    url: "https://eservices.nysed.gov/professions/verification-search",
    method: "POST",
    body: new URLSearchParams({ profession: "068", licenseNumber: "00000000", lastName: "ZZZZZZ" }).toString(),
    contentType: "application/x-www-form-urlencoded",
  },
  NC: {
    // Thentia public API pattern used by portal.ncvmb.org's SPA.
    url: "https://portal.ncvmb.org/api/registrant/search?q=00000000",
    method: "GET",
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function detectMarkers(snippet: string): string[] {
  const out: string[] = [];
  if (/F5|BIG-IP|The requested URL was rejected/i.test(snippet)) out.push("F5");
  if (/cloudflare|cf-ray|Attention Required|__cf_|Just a moment/i.test(snippet)) out.push("Cloudflare");
  if (/incap_ses|_Incapsula_|imperva/i.test(snippet)) out.push("Incapsula");
  if (/akamai|ak_bmsc/i.test(snippet)) out.push("Akamai");
  if (/hcaptcha|recaptcha|g-recaptcha|captcha/i.test(snippet)) out.push("Captcha");
  if (/Service\s+Unavailable/i.test(snippet)) out.push("ServiceUnavailable");
  return out;
}

async function fetchWithLimits(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1",
        "Accept-Language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
    });
    // Read up to MAX_BODY_BYTES then abort.
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (received < MAX_BODY_BYTES) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
      }
      try { await reader.cancel(); } catch { /* ignore */ }
    }
    const snippet = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.length === 1 ? chunks[0] : (() => {
        const buf = new Uint8Array(received);
        let o = 0;
        for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
        return buf;
      })(),
    );
    const clen = res.headers.get("content-length");
    const sessionCookie = !!res.headers.get("set-cookie");
    return {
      final_url: res.url,
      http_status: res.status,
      content_type: res.headers.get("content-type"),
      response_size_bytes: clen ? Number(clen) : received,
      elapsed_ms: Date.now() - started,
      snippet,
      session_cookie_required: sessionCookie,
    };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- Auth gate ----
  // Primary: admin-role user via bearer token.
  // Fallback (this temporary diagnostic only): server-to-server call with the
  // project's INTERNAL_FUNCTION_SECRET. Used only because the preview session
  // may not be logged in as an admin; secret is never logged or echoed.
  const internalSecret = Deno.env.get("PROBE_ADMIN_TOKEN") ?? "";
  const providedSecret = req.headers.get("x-probe-token") ?? "";
  const usingInternalSecret = internalSecret && providedSecret && providedSecret === internalSecret;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!usingInternalSecret) {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "forbidden" }, 403);
  }

  const started = Date.now();
  const body = await req.json().catch(() => ({}));
  const includeFormFlow = body?.include_form_flow !== false;

  const connectivity: Array<Record<string, unknown>> = [];
  const formFlow: Array<Record<string, unknown>> = [];

  // Run connectivity probes in parallel to stay under the client timeout.
  // Each request is independently bounded by CONNECT_TIMEOUT_MS.
  const connResults = await Promise.all(
    Object.entries(ALLOWLIST).map(async ([state, url]) => {
      try {
        const r = await fetchWithLimits(url, { method: "GET" }, CONNECT_TIMEOUT_MS);
        return {
          state,
          final_url: r.final_url,
          http_status: r.http_status,
          content_type: r.content_type,
          response_size_bytes: r.response_size_bytes,
          elapsed_ms: r.elapsed_ms,
          challenge_markers: detectMarkers(r.snippet),
          has_form: /<form|<input/i.test(r.snippet),
          timestamp: new Date().toISOString(),
        };
      } catch (e) {
        return {
          state,
          error: String((e as Error).message ?? e).slice(0, 200),
          timestamp: new Date().toISOString(),
        };
      }
    }),
  );
  connectivity.push(...connResults);

  if (includeFormFlow) {
    for (const [state, cfg] of Object.entries(FORM_FLOW)) {
      if (Date.now() - started > HANDLER_CEILING_MS) {
        formFlow.push({ state, error: "handler_ceiling_reached", timestamp: new Date().toISOString() });
        continue;
      }
      try {
        const r = await fetchWithLimits(cfg.url, {
          method: cfg.method,
          body: cfg.method === "POST" ? cfg.body : undefined,
          headers: cfg.method === "POST"
            ? { "Content-Type": cfg.contentType ?? "application/x-www-form-urlencoded" }
            : undefined,
        }, FORM_TIMEOUT_MS);
        formFlow.push({
          state,
          method: cfg.method,
          http_status: r.http_status,
          content_type: r.content_type,
          response_size_bytes: r.response_size_bytes,
          elapsed_ms: r.elapsed_ms,
          no_results_seen: /no\s+(records|results|matches)|not\s+found|0\s+results/i.test(r.snippet),
          captcha_seen: /captcha/i.test(r.snippet),
          js_required_seen: /javascript\s+(is\s+)?required|enable\s+javascript/i.test(r.snippet),
          session_cookie_required: r.session_cookie_required,
          challenge_markers: detectMarkers(r.snippet),
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        formFlow.push({
          state,
          method: cfg.method,
          error: String((e as Error).message ?? e).slice(0, 200),
          timestamp: new Date().toISOString(),
        });
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Bucket the results.
  const bucket = (c: Record<string, unknown>): string => {
    if (c.error) {
      const msg = String(c.error).toLowerCase();
      if (msg.includes("resolve") || msg.includes("dns")) return "url_stale_or_unresolved";
      if (msg.includes("timeout") || msg.includes("abort")) return "temporarily_unavailable";
      return "temporarily_unavailable";
    }
    const markers = (c.challenge_markers as string[]) ?? [];
    if (markers.includes("Captcha")) return "captcha_or_manual";
    if (markers.includes("Cloudflare") || markers.includes("F5") || markers.includes("Incapsula") || markers.includes("Akamai")) return "browserless_required";
    if (markers.includes("ServiceUnavailable")) return "temporarily_unavailable";
    if (typeof c.http_status === "number" && (c.http_status as number) >= 500) return "temporarily_unavailable";
    if (typeof c.http_status === "number" && (c.http_status as number) === 403) return "browserless_required";
    if (typeof c.http_status === "number" && (c.http_status as number) === 200 && c.has_form) return "directly_accessible";
    if (typeof c.http_status === "number" && (c.http_status as number) === 200) return "accessible_form_ok";
    return "temporarily_unavailable";
  };

  const buckets: Record<string, string[]> = {
    directly_accessible: [], accessible_form_ok: [], browserless_required: [],
    captcha_or_manual: [], url_stale_or_unresolved: [], temporarily_unavailable: [],
  };
  for (const c of connectivity) buckets[bucket(c)].push(c.state as string);

  const summary = { connectivity, form_flow: formFlow, summary_buckets: buckets };
  console.log("verify-license-probe result", JSON.stringify(summary));
  return json(summary);
});
