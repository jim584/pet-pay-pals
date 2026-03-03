import { supabase } from "@/integrations/supabase/client";

export interface PetStory {
  id: string;
  pet_id: string;
  author_id: string;
  title: string;
  content: string;
  photo_urls: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  pets?: { name: string; species: string; breed: string | null; photo_url: string | null };
  profiles?: { full_name: string; avatar_url: string | null };
}

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

export interface Wallet {
  id: string;
  user_id: string;
  wallet_balance: number;
  direct_pay_balance: number;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  wallet_portion: number;
  direct_pay_portion: number;
  description: string | null;
  related_story_id: string | null;
  from_user_id: string | null;
  created_at: string;
}

export const STORIES_PAGE_SIZE = 6;

export async function fetchStories(page = 0) {
  const from = page * STORIES_PAGE_SIZE;
  const to = from + STORIES_PAGE_SIZE - 1;
  const { data, error } = await supabase
    .from("pet_stories")
    .select("*, pets(name, species, breed, photo_url), profiles:author_id(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data as unknown as PetStory[];
}

export async function createStory(story: { pet_id: string; author_id: string; title: string; content: string; photo_urls: string[] }) {
  const { data, error } = await supabase.from("pet_stories").insert(story).select().single();
  if (error) throw error;
  return data;
}

export async function deleteStory(id: string) {
  const { error } = await supabase.from("pet_stories").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleLike(storyId: string, userId: string) {
  // Check if already liked
  const { data: existing } = await supabase
    .from("story_likes")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("story_likes").delete().eq("id", existing.id);
    return false;
  } else {
    await supabase.from("story_likes").insert({ story_id: storyId, user_id: userId });
    return true;
  }
}

export async function checkUserLiked(storyId: string, userId: string) {
  const { data } = await supabase
    .from("story_likes")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function fetchComments(storyId: string) {
  const { data, error } = await supabase
    .from("story_comments")
    .select("*, profiles:user_id(full_name, avatar_url)")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as StoryComment[];
}

export async function addComment(storyId: string, userId: string, content: string) {
  const { data, error } = await supabase
    .from("story_comments")
    .insert({ story_id: storyId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("story_comments").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchWallet(userId: string) {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Wallet | null;
}

export async function fetchTransactions(walletId: string) {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as WalletTransaction[];
}

export async function sendDonation(fromUserId: string, toUserId: string, amount: number, storyId?: string) {
  const { error } = await supabase.rpc("process_donation", {
    _from_user_id: fromUserId,
    _to_user_id: toUserId,
    _amount: amount,
    _story_id: storyId || null,
  });
  if (error) throw error;
}

export async function uploadStoryPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("pet-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return data.publicUrl;
}
