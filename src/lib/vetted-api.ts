import { supabase } from "@/integrations/supabase/client";

// The Vetted section is a read-only mirror of the Vetted ecosystem's approved
// catalog. Help a Pet never authors products: rows arrive through an admin
// import (and later, whatever sync method the Vetted team confirms).

export interface VettedProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_text: string | null;
  price_amount: number | null;
  currency: string | null;
  brand: string | null;
  sku: string | null;
  tags: string[];
  external_url: string;
  store_name: string | null;
  category: string;
  source: string;
  source_product_id: string | null;
  approved: boolean;
  approval_status: string;
  admin_hidden: boolean;
  delisted_at: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface VettedSyncRun {
  id: string;
  source: string;
  mode: string;
  status: string;
  filename: string | null;
  created_count: number;
  updated_count: number;
  delisted_count: number;
  skipped_count: number;
  total_count: number;
  errors: string[];
  started_at: string;
  finished_at: string | null;
}

export interface VettedSyncConfig {
  id: string;
  source: string;
  adapter: string;
  feed_url: string | null;
  auth_header_name: string | null;
  enabled: boolean;
  notes: string | null;
  last_success_at: string | null;
}

export interface VettedImportSummary {
  dry_run: boolean;
  total_rows?: number;
  parsed_count?: number;
  approved_count?: number;
  not_approved_count?: number;
  created_count?: number;
  updated_count?: number;
  delisted_count?: number;
  skipped_count: number;
  errors: string[];
  sample?: Array<{ name: string; store_name: string | null; category: string; price_text: string | null }>;
}

const PAGE_SIZE = 12;

export async function fetchVettedProducts(
  page: number,
  category?: string,
  search?: string
): Promise<VettedProduct[]> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("vetted_products")
    .select("*")
    .eq("approved", true)
    .eq("admin_hidden", false)
    .is("delisted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (category && category !== "all") query = query.eq("category", category);

  if (search && search.trim()) {
    const s = search.replace(/[%,]/g, "");
    query = query.or(
      `name.ilike.%${s}%,description.ilike.%${s}%,store_name.ilike.%${s}%,brand.ilike.%${s}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as VettedProduct[];
}

/** Timestamp of the most recent catalog sync, for the "last synced" note. */
export async function fetchLastCatalogSync(): Promise<string | null> {
  const { data } = await supabase
    .from("vetted_products")
    .select("synced_at")
    .not("synced_at", "is", null)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { synced_at: string | null } | null)?.synced_at ?? null;
}

/* ---------------------------------- admin --------------------------------- */

export async function fetchAllVettedProducts(search?: string): Promise<VettedProduct[]> {
  let query = supabase
    .from("vetted_products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (search && search.trim()) {
    const s = search.replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${s}%,store_name.ilike.%${s}%,brand.ilike.%${s}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as VettedProduct[];
}

export async function setProductHidden(id: string, hidden: boolean) {
  const { error } = await supabase.from("vetted_products").update({ admin_hidden: hidden }).eq("id", id);
  if (error) throw error;
}

export async function fetchSyncRuns(): Promise<VettedSyncRun[]> {
  const { data, error } = await supabase
    .from("vetted_sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as VettedSyncRun[];
}

export async function fetchSyncConfig(): Promise<VettedSyncConfig | null> {
  const { data, error } = await supabase
    .from("vetted_sync_config")
    .select("*")
    .eq("source", "vetted")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as VettedSyncConfig | null;
}

export async function updateSyncConfig(patch: Partial<VettedSyncConfig>) {
  const { error } = await supabase
    .from("vetted_sync_config")
    .update(patch as never)
    .eq("source", "vetted");
  if (error) throw error;
}

export async function uploadCatalogFile(file: File): Promise<string> {
  const path = `vetted/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("vetted-imports").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function runCatalogImport(params: {
  file_path: string;
  file_format?: string | null;
  full_catalog?: boolean;
  dry_run?: boolean;
}): Promise<VettedImportSummary> {
  const { data, error } = await supabase.functions.invoke("import-vetted-products", {
    body: { adapter: "file_import", ...params },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) {
    throw new Error((data as { message?: string; error: string }).message ?? (data as { error: string }).error);
  }
  return data as VettedImportSummary;
}
