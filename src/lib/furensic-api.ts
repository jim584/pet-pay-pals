import { supabase } from "@/integrations/supabase/client";

export type FurensicKind = "blog" | "video" | "podcast";

export const FURENSIC_KINDS: { value: FurensicKind; label: string }[] = [
  { value: "blog", label: "Blog" },
  { value: "video", label: "Video" },
  { value: "podcast", label: "Podcast" },
];

export interface FurensicEntry {
  id: string;
  kind: FurensicKind;
  title: string;
  summary: string | null;
  body: string | null;
  cover_image_url: string | null;
  media_url: string | null;
  embed_url: string | null;
  media_provider: string | null;
  duration_label: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Parsed representation of a supported embeddable media link. */
export interface ParsedMedia {
  provider: "youtube" | "vimeo" | "spotify" | "other";
  /** URL to render inside an in-app iframe player, when embeddable. */
  embedUrl: string | null;
  /** The original link, always preserved so users can open the source. */
  sourceUrl: string;
  thumbnailUrl: string | null;
}

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;
const SPOTIFY_RE = /open\.spotify\.com\/(episode|show|track|playlist)\/([a-zA-Z0-9]+)/;

export function parseMediaUrl(rawUrl: string): ParsedMedia | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const yt = url.match(YOUTUBE_RE);
  if (yt) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`,
      sourceUrl: `https://www.youtube.com/watch?v=${yt[1]}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }

  const vm = url.match(VIMEO_RE);
  if (vm) {
    return {
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vm[1]}`,
      sourceUrl: `https://vimeo.com/${vm[1]}`,
      thumbnailUrl: null,
    };
  }

  const sp = url.match(SPOTIFY_RE);
  if (sp) {
    return {
      provider: "spotify",
      embedUrl: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`,
      sourceUrl: url,
      thumbnailUrl: null,
    };
  }

  if (!/^https?:\/\//i.test(url)) return null;
  return { provider: "other", embedUrl: null, sourceUrl: url, thumbnailUrl: null };
}

export function providerLabel(provider: string | null): string {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    case "spotify":
      return "Spotify";
    default:
      return "source";
  }
}

export interface FurensicFilters {
  kind?: FurensicKind | "all";
  search?: string;
  includeDrafts?: boolean;
}

export async function fetchFurensicEntries(filters: FurensicFilters = {}) {
  let q = supabase
    .from("furensic_entries")
    .select("*")
    .order("sort_order", { ascending: false })
    .order("published_at", { ascending: false });

  if (!filters.includeDrafts) q = q.eq("is_published", true);
  if (filters.kind && filters.kind !== "all") q = q.eq("kind", filters.kind);
  if (filters.search?.trim()) {
    const t = `%${filters.search.trim()}%`;
    q = q.or(`title.ilike.${t},summary.ilike.${t},body.ilike.${t}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as FurensicEntry[];
}

export interface FurensicEntryInput {
  kind: FurensicKind;
  title: string;
  summary?: string | null;
  body?: string | null;
  cover_image_url?: string | null;
  media_url?: string | null;
  duration_label?: string | null;
  tags?: string[];
  is_published?: boolean;
  sort_order?: number;
}

function buildRow(input: FurensicEntryInput) {
  const parsed = input.media_url ? parseMediaUrl(input.media_url) : null;
  return {
    kind: input.kind,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    body: input.body?.trim() || null,
    cover_image_url: input.cover_image_url?.trim() || parsed?.thumbnailUrl || null,
    media_url: parsed?.sourceUrl ?? (input.media_url?.trim() || null),
    embed_url: parsed?.embedUrl ?? null,
    media_provider: parsed?.provider ?? null,
    duration_label: input.duration_label?.trim() || null,
    tags: input.tags ?? [],
    is_published: input.is_published ?? true,
    sort_order: input.sort_order ?? 0,
  };
}

export async function createFurensicEntry(input: FurensicEntryInput, userId?: string) {
  const { error } = await supabase
    .from("furensic_entries")
    .insert({ ...buildRow(input), created_by: userId ?? null } as never);
  if (error) throw error;
}

export async function updateFurensicEntry(id: string, input: FurensicEntryInput) {
  const { error } = await supabase
    .from("furensic_entries")
    .update(buildRow(input) as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFurensicEntry(id: string) {
  const { error } = await supabase.from("furensic_entries").delete().eq("id", id);
  if (error) throw error;
}
