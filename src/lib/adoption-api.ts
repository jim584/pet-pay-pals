import { supabase } from "@/integrations/supabase/client";

export interface AdoptionListing {
  id: string;
  pet_name: string;
  species: string;
  breed: string | null;
  age_text: string | null;
  gender: string | null;
  description: string | null;
  photo_urls: string[] | null;
  shelter_name: string;
  shelter_location: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_website: string | null;
  is_adopted: boolean;
  posted_by: string;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 8;

export async function fetchAdoptionListings(
  page: number,
  speciesFilter?: string,
  searchQuery?: string
) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("adoption_listings")
    .select("*")
    .eq("is_adopted", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (speciesFilter && speciesFilter !== "all") {
    query = query.eq("species", speciesFilter);
  }

  if (searchQuery && searchQuery.trim()) {
    const term = `%${searchQuery.trim()}%`;
    query = query.or(`pet_name.ilike.${term},breed.ilike.${term},shelter_location.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AdoptionListing[];
}

export async function createAdoptionListing(
  listing: Omit<AdoptionListing, "id" | "created_at" | "updated_at" | "is_adopted">
) {
  const { data, error } = await supabase
    .from("adoption_listings")
    .insert(listing)
    .select()
    .single();
  if (error) throw error;
  return data as AdoptionListing;
}

export async function markAsAdopted(listingId: string) {
  const { error } = await supabase
    .from("adoption_listings")
    .update({ is_adopted: true })
    .eq("id", listingId);
  if (error) throw error;
}

export async function uploadAdoptionPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `adoption/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("pet-photos")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return data.publicUrl;
}
