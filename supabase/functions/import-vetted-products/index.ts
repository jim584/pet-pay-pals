// Ingests the Vetted-approved product catalog into Help a Pet's read-only mirror.
//
// Adapters:
//   - file_import (live): an admin uploads a CSV/TSV/JSON/XLSX export of the
//     approved catalog to the private `vetted-imports` bucket.
//   - http_feed   (disabled): placeholder for whatever delivery method the
//     Vetted team confirms later. It is intentionally not wired to any URL.
//
// Both adapters produce raw rows that go through the same normalizer, so the
// storefront and schema never change when the real integration lands.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { parseSource, type FileFormat } from "../_shared/vet-license-parsers.ts";
import { normalizeProduct, type NormalizedProduct, type RawRow } from "../_shared/vetted-normalize.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SOURCE = "vetted";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatFromName(name: string, explicit?: string | null): FileFormat {
  const f = (explicit ?? "").toLowerCase();
  if (["csv", "tsv", "json", "xlsx"].includes(f)) return f as FileFormat;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "tsv") return "tsv";
  if (ext === "json") return "json";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  return "csv";
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
    adapter?: string;
    file_path?: string | null;
    file_format?: string | null;
    full_catalog?: boolean;
    dry_run?: boolean;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const adapter = body.adapter ?? "file_import";
  if (adapter === "http_feed") {
    return json({
      error: "adapter_disabled",
      message:
        "The automatic Vetted feed is not enabled. The delivery method (API, feed, push or replication) still has to be confirmed with the Vetted team.",
    }, 400);
  }
  if (adapter !== "file_import") return json({ error: "unknown_adapter" }, 400);
  if (!body.file_path) return json({ error: "file_path is required for a file import" }, 400);

  const dryRun = body.dry_run === true;
  const fullCatalog = body.full_catalog !== false;

  // 1. Read the uploaded catalog export.
  const { data: blob, error: dlError } = await admin.storage.from("vetted-imports").download(body.file_path);
  if (dlError || !blob) return json({ error: "download_failed", message: dlError?.message ?? "File not found" }, 400);

  let rows: RawRow[];
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    rows = await parseSource(formatFromName(body.file_path, body.file_format), bytes, {});
  } catch (e) {
    return json({ error: "parse_failed", message: (e as Error).message }, 400);
  }

  // 2. Normalize.
  const errors: string[] = [];
  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  rows.forEach((row, i) => {
    const { product, error } = normalizeProduct(row, i);
    if (error) { errors.push(error); skipped++; return; }
    if (!product) { skipped++; return; }
    if (seen.has(product.source_product_id)) {
      errors.push(`Row ${i + 1} (${product.name}): duplicate product id "${product.source_product_id}" — kept the first one`);
      skipped++;
      return;
    }
    seen.add(product.source_product_id);
    products.push(product);
  });

  const approvedCount = products.filter((p) => p.approved).length;

  if (dryRun) {
    return json({
      dry_run: true,
      total_rows: rows.length,
      parsed_count: products.length,
      approved_count: approvedCount,
      not_approved_count: products.length - approvedCount,
      skipped_count: skipped,
      errors: errors.slice(0, 50),
      sample: products.slice(0, 5),
    });
  }

  // 3. Commit against the mirror.
  const { data: run } = await admin.from("vetted_sync_runs").insert({
    source: SOURCE,
    mode: fullCatalog ? "file_import_full" : "file_import_partial",
    status: "running",
    filename: body.file_path,
    total_count: rows.length,
    run_by: user.id,
  }).select("id").single();

  const { data: existing } = await admin
    .from("vetted_products")
    .select("id, source_product_id")
    .eq("source", SOURCE);
  const existingIds = new Set((existing ?? []).map((r) => r.source_product_id));

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (let i = 0; i < products.length; i += 200) {
    const chunk = products.slice(i, i + 200).map((p) => ({
      ...p,
      source: SOURCE,
      synced_at: now,
      delisted_at: null,
      approved_at: p.approved ? now : null,
      listed_by: null,
    }));
    const { error } = await admin
      .from("vetted_products")
      .upsert(chunk, { onConflict: "source,source_product_id" });
    if (error) {
      errors.push(`Batch starting at row ${i + 1}: ${error.message}`);
      continue;
    }
    for (const p of chunk) {
      if (existingIds.has(p.source_product_id)) updated++; else created++;
    }
  }

  // Anything absent from a full-catalog sync is delisted, never deleted.
  let delisted = 0;
  if (fullCatalog && products.length > 0) {
    const keep = products.map((p) => p.source_product_id);
    const stale = (existing ?? []).filter((r) => r.source_product_id && !keep.includes(r.source_product_id));
    if (stale.length > 0) {
      const { error } = await admin
        .from("vetted_products")
        .update({ delisted_at: now, approved: false, approval_status: "delisted" })
        .in("id", stale.map((r) => r.id));
      if (error) errors.push(`Delisting removed products: ${error.message}`);
      else delisted = stale.length;
    }
  }

  const summary = {
    created_count: created,
    updated_count: updated,
    delisted_count: delisted,
    skipped_count: skipped,
    total_count: rows.length,
    errors: errors.slice(0, 50),
  };

  if (run?.id) {
    await admin.from("vetted_sync_runs").update({
      ...summary,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      finished_at: now,
    }).eq("id", run.id);
  }
  await admin.from("vetted_sync_config").update({ last_success_at: now }).eq("source", SOURCE);

  return json({ dry_run: false, ...summary });
});
