import { supabase } from "@/integrations/supabase/client";

export const STORY_CATEGORIES = [
  { value: "general", label: "General", color: "bg-muted text-muted-foreground" },
  { value: "recovery", label: "Recovery", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { value: "adoption", label: "Adoption", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
  { value: "milestone", label: "Milestone", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "rescue", label: "Rescue", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  { value: "memorial", label: "Memorial", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
] as const;

export type StoryCategory = typeof STORY_CATEGORIES[number]["value"];

export interface PetStory {
  id: string;
  pet_id: string;
  author_id: string;
  title: string;
  content: string;
  category: StoryCategory;
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
  parent_comment_id: string | null;
  likes_count: number;
  created_at: string;
  updated_at: string;
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

export async function createStory(story: { pet_id: string; author_id: string; title: string; content: string; photo_urls: string[]; category?: string }) {
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

export async function batchCheckLiked(storyIds: string[], userId: string): Promise<Set<string>> {
  if (storyIds.length === 0) return new Set();
  const { data } = await supabase
    .from("story_likes")
    .select("story_id")
    .eq("user_id", userId)
    .in("story_id", storyIds);
  return new Set((data || []).map((r: any) => r.story_id));
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

export async function addComment(storyId: string, userId: string, content: string, parentCommentId?: string) {
  const { data, error } = await supabase
    .from("story_comments")
    .insert({ story_id: storyId, user_id: userId, content, parent_comment_id: parentCommentId || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("story_comments").delete().eq("id", id);
  if (error) throw error;
}

export async function editComment(id: string, content: string) {
  const { error } = await supabase.from("story_comments").update({ content }).eq("id", id);
  if (error) throw error;
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("comment_likes").delete().eq("id", existing.id);
    return false;
  } else {
    await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
    return true;
  }
}

export async function batchCheckCommentLiked(commentIds: string[], userId: string): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  const { data } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", userId)
    .in("comment_id", commentIds);
  return new Set((data || []).map((r: any) => r.comment_id));
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
