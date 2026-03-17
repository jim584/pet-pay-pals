import { supabase } from "@/integrations/supabase/client";

export interface VettedProduct {
  id: string;
  listed_by: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_text: string | null;
  external_url: string;
  store_name: string | null;
  category: string;
  created_at: string;
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
    .order("created_at", { ascending: false })
    .range(from, to);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (search && search.trim()) {
    query = query.or(
      `name.ilike.%${search}%,description.ilike.%${search}%,store_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VettedProduct[];
}

export async function createVettedProduct(product: {
  name: string;
  description?: string;
  image_url?: string;
  price_text?: string;
  external_url: string;
  store_name?: string;
  category: string;
  listed_by: string;
}) {
  const { error } = await supabase.from("vetted_products").insert(product);
  if (error) throw error;
}

export async function deleteVettedProduct(id: string) {
  const { error } = await supabase.from("vetted_products").delete().eq("id", id);
  if (error) throw error;
}
