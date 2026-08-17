import { supabase } from "@/integrations/supabase/client";

export interface VetLicenseRecord {
  id: string;
  state: string;
  license_number: string;
  full_name: string;
  normalized_name: string;
  first_name: string | null;
  last_name: string | null;
  license_status: string;
  license_status_raw: string | null;
  license_type: string;
  license_type_raw: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  address_state: string | null;
  postal_code: string | null;
  county: string | null;
  phone: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  source_authority: string | null;
  source_url: string | null;
  source_synced_at: string | null;
  last_synced_at: string;
  is_active: boolean;
}

export interface VetLicenseSource {
  state_code: string;
  state_name: string;
  authority: string;
  import_method: "api" | "bulk_file" | "manual_upload" | "none_yet";
  source_url: string | null;
  file_format: "csv" | "tsv" | "xlsx" | "json" | "fixed_width" | null;
  refresh_cadence_days: number;
  auto_sync_enabled: boolean;
  is_full_snapshot: boolean;
  mapping: Record<string, unknown>;
  notes: string | null;
  record_count: number;
  last_synced_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export interface VetLicenseImportRun {
  id: string;
  state_code: string;
  trigger_source: string;
  import_method: string;
  file_path: string | null;
  status: "running" | "success" | "failed" | "partial";
  rows_read: number;
  rows_kept: number;
  rows_filtered_status: number;
  rows_filtered_type: number;
  rows_invalid: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deactivated: number;
  error_message: string | null;
  error_samples: { reason: string; count: number }[];
  started_at: string;
  finished_at: string | null;
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
  sample_kept: Partial<VetLicenseRecord>[];
  error_samples: { reason: string; count: number }[];
  status: "success" | "failed" | "partial";
  error_message?: string;
}

export async function fetchLicenseSources(): Promise<VetLicenseSource[]> {
  const { data, error } = await supabase
    .from("vet_license_sources")
    .select("*")
    .order("state_name");
  if (error) throw error;
  return (data ?? []) as unknown as VetLicenseSource[];
}

export async function updateLicenseSource(stateCode: string, updates: Partial<VetLicenseSource>) {
  const { error } = await supabase
    .from("vet_license_sources")
    .update(updates as never)
    .eq("state_code", stateCode);
  if (error) throw error;
}

export async function fetchImportRuns(stateCode?: string, limit = 25): Promise<VetLicenseImportRun[]> {
  let q = supabase
    .from("vet_license_import_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (stateCode) q = q.eq("state_code", stateCode);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as VetLicenseImportRun[];
}

/** Uploads a source file to the private import bucket and returns its path. */
export async function uploadImportFile(stateCode: string, file: File): Promise<string> {
  const path = `${stateCode}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("vet-license-imports").upload(path, file, {
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function runLicenseImport(params: {
  state_code: string;
  file_path?: string | null;
  source_url?: string | null;
  file_format?: string | null;
  dry_run?: boolean;
}): Promise<ImportSummary> {
  const { data, error } = await supabase.functions.invoke("import-vet-licenses", { body: params });
  if (error) {
    // Edge functions return the summary body on 422; surface its message when present.
    const ctx = (error as { context?: { json?: () => Promise<ImportSummary> } }).context;
    if (ctx?.json) {
      try {
        const body = await ctx.json();
        if (body?.error_message || body?.status) return body;
      } catch { /* fall through */ }
    }
    throw error;
  }
  return data as ImportSummary;
}

export async function syncLicenseState(stateCode: string) {
  const { data, error } = await supabase.functions.invoke("sync-vet-licenses", {
    body: { state_code: stateCode, force: true },
  });
  if (error) throw error;
  return data;
}

/** Typeahead over the license database (name, license number, or city). */
export async function searchVetLicenses(q: string, state?: string | null, limit = 20) {
  const { data, error } = await supabase.rpc("search_vet_licenses", {
    _q: q,
    _state: state ?? null,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as VetLicenseRecord[];
}

/** Exact lookup used by vet signup verification. */
export async function lookupLicense(state: string, licenseNumber: string) {
  const { data, error } = await supabase
    .from("vet_license_records")
    .select("*")
    .eq("state", state.toUpperCase())
    .eq("license_number", licenseNumber.toUpperCase().trim())
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as VetLicenseRecord) ?? null;
}

export function stalenessDays(source: VetLicenseSource): number | null {
  if (!source.last_success_at) return null;
  return Math.floor((Date.now() - new Date(source.last_success_at).getTime()) / 86_400_000);
}
