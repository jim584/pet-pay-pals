import { supabase } from "@/integrations/supabase/client";

export interface FeedStory {
  id: string;
  pet_id: string;
  author_id: string;
  title: string;
  content: string;
  photo_urls: string[];
  likes_count: number;
  comments_count: number;
  category: string;
  created_at: string;
  pets: { name: string; photo_url: string | null; species: string; breed: string | null; followers_count: number };
  profiles: { full_name: string; avatar_url: string | null };
}

export interface SuggestedPet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  followers_count: number;
  owner_id: string;
  profiles: { full_name: string; avatar_url: string | null };
}

export const FEED_PAGE_SIZE = 6;

export async function fetchPublicFeed(page: number = 0): Promise<FeedStory[]> {
  try {
    const from = page * FEED_PAGE_SIZE;
    const to = from + FEED_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("pet_stories")
      .select("*, pets(name, photo_url, species, breed, followers_count), profiles:author_id(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data as unknown as FeedStory[];
  } catch {
    return [];
  }
}

export async function fetchSuggestedPets(userId?: string): Promise<SuggestedPet[]> {
  try {
    const { data, error } = await supabase
      .from("pets")
      .select("id, name, species, breed, photo_url, followers_count, owner_id, profiles:owner_id(full_name, avatar_url)")
      .order("followers_count", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data as unknown as SuggestedPet[];
  } catch {
    return [];
  }
}

export async function followPet(petId: string, userId: string) {
  const { error } = await supabase.from("pet_follows").insert({ pet_id: petId, user_id: userId });
  if (error) throw error;
}

export async function unfollowPet(petId: string, userId: string) {
  const { error } = await supabase.from("pet_follows").delete().eq("pet_id", petId).eq("user_id", userId);
  if (error) throw error;
}

export async function checkFollowing(petIds: string[], userId: string) {
  const { data, error } = await supabase
    .from("pet_follows")
    .select("pet_id")
    .eq("user_id", userId)
    .in("pet_id", petIds);
  if (error) throw error;
  return new Set((data ?? []).map((d) => d.pet_id));
}
