// Shared import runner for the veterinarian license database.
// Used by both `import-vet-licenses` (admin-triggered) and `sync-vet-licenses`
// (scheduled), so a manual upload produces exactly the same data quality as an
// automated API/bulk sync.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeRow, type FieldMapping, type NormalizedRecord } from "./vet-license-normalize.ts";
import { parseSource, type FileFormat } from "./vet-license-parsers.ts";

export interface SourceRow {
  state_code: string;
  state_name: string;
  authority: string;
  import_method: string;
  source_url: string | null;
  file_format: string | null;
  is_full_snapshot: boolean;
  mapping: FieldMapping;
}

export interface ImportOptions {
  /** Storage path in the `vet-license-imports` bucket (admin upload path). */
  filePath?: string | null;
  /** Overrides the registry URL for this run. */
  sourceUrl?: string | null;
  /** Overrides the registry format for this run. */
  fileFormat?: FileFormat | null;
  /** Parse + filter only; nothing is written. */
  dryRun?: boolean;
  triggerSource?: string;
  triggeredBy?: string | null;
}

export interface ImportSummary {
  state_code: string;
  dry_run: boolean;
  rows_read: number;
  rows_kept: number;
  rows_filtered_status: number;
  rows_filtered_type: number;
  rows_invalid: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deactivated: number;
  sample_kept: NormalizedRecord[];
  error_samples: { reason: string; count: number }[];
  run_id: string | null;
  status: "success" | "failed" | "partial";
  error_message?: string;
}

const CHUNK = 500;

async function fetchBytes(source: SourceRow, opts: ImportOptions, admin: SupabaseClient): Promise<Uint8Array> {
  if (opts.filePath) {
    const { data, error } = await admin.storage.from("vet-license-imports").download(opts.filePath);
    if (error || !data) throw new Error(`Could not read uploaded file: ${error?.message ?? "not found"}`);
    return new Uint8Array(await data.arrayBuffer());
  }
  const url = opts.sourceUrl ?? source.source_url;
  if (!url) throw new Error("No file uploaded and no source URL configured for this state");
  const res = await fetch(url, { headers: { "User-Agent": "HelpAPet-LicenseSync/1.0" } });
  if (!res.ok) throw new Error(`Source responded ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

function tally(map: Map<string, number>, reason: string) {
  const key = reason.slice(0, 120);
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function runImport(
  admin: SupabaseClient,
  source: SourceRow,
  opts: ImportOptions = {},
): Promise<ImportSummary> {
  const state = source.state_code.toUpperCase();
  const dryRun = opts.dryRun === true;
  const format = (opts.fileFormat ?? source.file_format ?? "csv") as FileFormat;
  const mapping = (source.mapping ?? {}) as FieldMapping;

  let runId: string | null = null;
  if (!dryRun) {
    const { data: run } = await admin.from("vet_license_import_runs").insert({
      state_code: state,
      trigger_source: opts.triggerSource ?? "manual",
      triggered_by: opts.triggeredBy ?? null,
      import_method: opts.filePath ? "manual_upload" : source.import_method,
      file_path: opts.filePath ?? null,
      status: "running",
    }).select("id").maybeSingle();
    runId = run?.id ?? null;
  }

  const summary: ImportSummary = {
    state_code: state,
    dry_run: dryRun,
    rows_read: 0, rows_kept: 0, rows_filtered_status: 0, rows_filtered_type: 0,
    rows_invalid: 0, rows_inserted: 0, rows_updated: 0, rows_deactivated: 0,
    sample_kept: [], error_samples: [], run_id: runId, status: "success",
  };

  const reasons = new Map<string, number>();

  try {
    const bytes = await fetchBytes(source, opts, admin);
    const rows = await parseSource(format, bytes, mapping);
    summary.rows_read = rows.length;
    if (rows.length === 0) throw new Error("Source file contained no rows");

    const kept = new Map<string, NormalizedRecord>();
    for (const row of rows) {
      const outcome = normalizeRow(state, row, mapping);
      switch (outcome.kind) {
        case "kept": kept.set(outcome.record.license_number, outcome.record); break;
        case "filtered_status": summary.rows_filtered_status++; tally(reasons, `status: ${outcome.reason}`); break;
        case "filtered_type": summary.rows_filtered_type++; tally(reasons, `type: ${outcome.reason}`); break;
        case "invalid": summary.rows_invalid++; tally(reasons, `invalid: ${outcome.reason}`); break;
      }
    }
    summary.rows_kept = kept.size;
    summary.sample_kept = [...kept.values()].slice(0, 10);
    summary.error_samples = [...reasons.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([reason, count]) => ({ reason, count }));

    if (summary.rows_kept === 0) throw new Error("No active standard veterinary licenses found — check the field mapping");

    if (!dryRun) {
      const syncedAt = new Date().toISOString();
      const numbers = [...kept.keys()];

      // Count pre-existing rows for this state so insert/update split is accurate.
      const { data: priorRows } = await admin
        .from("vet_license_records")
        .select("license_number")
        .eq("state", state);
      const prior = new Set((priorRows ?? []).map((r: { license_number: string }) => r.license_number));

      const payload = [...kept.values()].map((r) => ({
        ...r,
        source_authority: source.authority,
        source_url: opts.sourceUrl ?? source.source_url,
        source_synced_at: syncedAt,
        last_synced_at: syncedAt,
        is_active: true,
        deactivated_at: null,
      }));

      for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        const { error } = await admin
          .from("vet_license_records")
          .upsert(slice, { onConflict: "state,license_number" });
        if (error) throw new Error(`Upsert failed: ${error.message}`);
      }
      summary.rows_inserted = numbers.filter((n) => !prior.has(n)).length;
      summary.rows_updated = numbers.length - summary.rows_inserted;

      // Full snapshots: anything not present in this file is no longer active.
      if (source.is_full_snapshot) {
        const { data: stale, error: staleErr } = await admin
          .from("vet_license_records")
          .update({ is_active: false, deactivated_at: syncedAt })
          .eq("state", state)
          .eq("is_active", true)
          .lt("last_synced_at", syncedAt)
          .select("id");
        if (staleErr) throw new Error(`Deactivation failed: ${staleErr.message}`);
        summary.rows_deactivated = stale?.length ?? 0;
      }

      const { count } = await admin
        .from("vet_license_records")
        .select("id", { count: "exact", head: true })
        .eq("state", state)
        .eq("is_active", true);

      await admin.from("vet_license_sources").update({
        record_count: count ?? summary.rows_kept,
        last_synced_at: syncedAt,
        last_success_at: syncedAt,
        last_error: null,
      }).eq("state_code", state);

      if (runId) {
        await admin.from("vet_license_import_runs").update({
          status: "success",
          rows_read: summary.rows_read,
          rows_kept: summary.rows_kept,
          rows_filtered_status: summary.rows_filtered_status,
          rows_filtered_type: summary.rows_filtered_type,
          rows_invalid: summary.rows_invalid,
          rows_inserted: summary.rows_inserted,
          rows_updated: summary.rows_updated,
          rows_deactivated: summary.rows_deactivated,
          error_samples: summary.error_samples,
          finished_at: new Date().toISOString(),
        }).eq("id", runId);
      }
    }
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 500);
    summary.status = "failed";
    summary.error_message = msg;
    if (!dryRun) {
      await admin.from("vet_license_sources").update({
        last_synced_at: new Date().toISOString(),
        last_error: msg,
      }).eq("state_code", state);
      if (runId) {
        await admin.from("vet_license_import_runs").update({
          status: "failed",
          rows_read: summary.rows_read,
          rows_kept: summary.rows_kept,
          rows_filtered_status: summary.rows_filtered_status,
          rows_filtered_type: summary.rows_filtered_type,
          rows_invalid: summary.rows_invalid,
          error_message: msg,
          error_samples: summary.error_samples,
          finished_at: new Date().toISOString(),
        }).eq("id", runId);
      }
    }
  }

  return summary;
}
