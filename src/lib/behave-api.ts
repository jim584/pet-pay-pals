import { supabase } from "@/integrations/supabase/client";

export const BEHAVE_PAGE_SIZE = 12;

export const BEHAVE_CATEGORIES = [
  "behavior-issues",
  "training-tips",
  "beginner-guides",
  "aggression",
  "obedience",
  "puppy-training",
] as const;

export const categoryLabel = (cat: string) =>
  cat
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// ─── Types ──────────────────────────────────────────────
export interface BehavePost {
  id: string;
  author_id: string;
  title: string;
  content: string;
  featured_image_url: string | null;
  category: string;
  tags: string[];
  excerpt: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

export interface BehaveImage {
  id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

export interface BehaveVideo {
  id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

// ─── Posts ───────────────────────────────────────────────
export async function fetchBehavePosts(page = 0, search?: string, category?: string) {
  const from = page * BEHAVE_PAGE_SIZE;
  const to = from + BEHAVE_PAGE_SIZE - 1;

  let q = supabase
    .from("behave_posts")
    .select("*, profiles:author_id(full_name, avatar_url)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search?.trim()) {
    const t = `%${search.trim()}%`;
    q = q.or(`title.ilike.${t},content.ilike.${t}`);
  }
  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as BehavePost[];
}

export async function createBehavePost(post: {
  author_id: string;
  title: string;
  content: string;
  featured_image_url?: string;
  category: string;
  tags?: string[];
  excerpt?: string;
}) {
  const { error } = await supabase.from("behave_posts").insert(post as any);
  if (error) throw error;
}

export async function deleteBehavePost(id: string) {
  const { error } = await supabase.from("behave_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function updateBehavePost(id: string, updates: {
  title?: string;
  content?: string;
  excerpt?: string;
  featured_image_url?: string;
  category?: string;
  tags?: string[];
  is_published?: boolean;
}) {
  const { error } = await supabase.from("behave_posts").update(updates as any).eq("id", id);
  if (error) throw error;
}

// ─── Images ─────────────────────────────────────────────
export async function fetchBehaveImages(page = 0, search?: string, category?: string) {
  const from = page * BEHAVE_PAGE_SIZE;
  const to = from + BEHAVE_PAGE_SIZE - 1;

  let q = supabase
    .from("behave_images")
    .select("*, profiles:uploaded_by(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search?.trim()) {
    const t = `%${search.trim()}%`;
    q = q.or(`title.ilike.${t},description.ilike.${t}`);
  }
  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as BehaveImage[];
}

export async function createBehaveImage(img: {
  uploaded_by: string;
  title: string;
  description?: string;
  image_url: string;
  category: string;
}) {
  const { error } = await supabase.from("behave_images").insert(img as any);
  if (error) throw error;
}

export async function deleteBehaveImage(id: string) {
  const { error } = await supabase.from("behave_images").delete().eq("id", id);
  if (error) throw error;
}

export async function updateBehaveImage(id: string, updates: {
  title?: string;
  description?: string;
  category?: string;
}) {
  const { error } = await supabase.from("behave_images").update(updates as any).eq("id", id);
  if (error) throw error;
}

// ─── Videos ─────────────────────────────────────────────
export async function fetchBehaveVideos(page = 0, search?: string, category?: string) {
  const from = page * BEHAVE_PAGE_SIZE;
  const to = from + BEHAVE_PAGE_SIZE - 1;

  let q = supabase
    .from("behave_videos")
    .select("*, profiles:uploaded_by(full_name, avatar_url)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search?.trim()) {
    const t = `%${search.trim()}%`;
    q = q.or(`title.ilike.${t},description.ilike.${t}`);
  }
  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as BehaveVideo[];
}

export async function createBehaveVideo(vid: {
  uploaded_by: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  category: string;
}) {
  const { error } = await supabase.from("behave_videos").insert(vid as any);
  if (error) throw error;
}

export async function deleteBehaveVideo(id: string) {
  const { error } = await supabase.from("behave_videos").delete().eq("id", id);
  if (error) throw error;
}

export async function updateBehaveVideo(id: string, updates: {
  title?: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  category?: string;
}) {
  const { error } = await supabase.from("behave_videos").update(updates as any).eq("id", id);
  if (error) throw error;
}

// ─── Upload helper ──────────────────────────────────────
export async function uploadBehaveMedia(userId: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("behave-media").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("behave-media").getPublicUrl(path);
  return data.publicUrl;
}
