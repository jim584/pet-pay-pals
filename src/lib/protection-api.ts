import { supabase } from "@/integrations/supabase/client";
import type { PetStory } from "@/lib/community-api";

export const PROTECTION_PAGE_SIZE = 6;

export async function fetchProtectionStories(page = 0, searchQuery?: string) {
  const from = page * PROTECTION_PAGE_SIZE;
  const to = from + PROTECTION_PAGE_SIZE - 1;

  let query = supabase
    .from("pet_stories")
    .select("*, pets(name, species, breed, photo_url), profiles:author_id(full_name, avatar_url)")
    .eq("category", "protection")
    .order("is_urgent", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (searchQuery?.trim()) {
    const term = `%${searchQuery.trim()}%`;
    query = query.or(`title.ilike.${term},content.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as PetStory[];
}
