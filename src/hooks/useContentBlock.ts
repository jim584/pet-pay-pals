import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ContentKind = "text" | "richtext" | "image" | "image_list";

export interface ContentBlock {
  id: string;
  key: string;
  kind: ContentKind;
  value_text: string | null;
  value_json: any;
  value_image_url: string | null;
  updated_at: string;
}

// In-memory cache for the session — content blocks change rarely.
const cache = new Map<string, ContentBlock | null>();
const inflight = new Map<string, Promise<ContentBlock | null>>();

async function fetchBlock(key: string): Promise<ContentBlock | null> {
  if (cache.has(key)) return cache.get(key) ?? null;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const { data } = await supabase
      .from("content_blocks")
      .select("*")
      .eq("key", key)
      .maybeSingle();
    cache.set(key, (data as any) ?? null);
    return (data as any) ?? null;
  })();
  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

/** Returns the text value for the given key, falling back to `fallback` until loaded or if missing. */
export function useContentText(key: string, fallback: string): string {
  const [value, setValue] = useState<string>(fallback);
  useEffect(() => {
    let mounted = true;
    fetchBlock(key).then((b) => {
      if (mounted && b?.value_text) setValue(b.value_text);
    });
    return () => { mounted = false; };
  }, [key]);
  return value;
}

/** Returns the image URL for the given key, falling back to `fallback`. */
export function useContentImage(key: string, fallback?: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(fallback);
  useEffect(() => {
    let mounted = true;
    fetchBlock(key).then((b) => {
      if (mounted && b?.value_image_url) setSrc(b.value_image_url);
    });
    return () => { mounted = false; };
  }, [key]);
  return src;
}

/** Returns a list of items (typically image carousel entries) stored as JSON. */
export function useContentList<T = any>(key: string, fallback: T[]): T[] {
  const [items, setItems] = useState<T[]>(fallback);
  useEffect(() => {
    let mounted = true;
    fetchBlock(key).then((b) => {
      if (mounted && Array.isArray(b?.value_json)) setItems(b!.value_json as T[]);
    });
    return () => { mounted = false; };
  }, [key]);
  return items;
}

export function invalidateContentBlock(key: string) {
  cache.delete(key);
}
