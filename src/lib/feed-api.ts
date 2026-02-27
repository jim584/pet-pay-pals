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

export async function fetchPublicFeed() {
  const { data, error } = await supabase
    .from("pet_stories")
    .select("*, pets(name, photo_url, species, breed, followers_count), profiles:author_id(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as unknown as FeedStory[];
}

export async function fetchSuggestedPets(userId?: string) {
  let query = supabase
    .from("pets")
    .select("id, name, species, breed, photo_url, followers_count, owner_id, profiles:owner_id(full_name, avatar_url)")
    .order("followers_count", { ascending: false })
    .limit(10);

  if (userId) {
    // Exclude pets the user already follows — we'll filter client-side since we can't do NOT IN easily
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as SuggestedPet[];
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
