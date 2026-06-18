import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Search, Trash2, Image as ImageIcon } from "lucide-react";
import { invalidateContentBlock } from "@/hooks/useContentBlock";
import { useAuth } from "@/contexts/AuthContext";

interface ContentBlock {
  id: string;
  key: string;
  kind: "text" | "richtext" | "image" | "image_list";
  value_text: string | null;
  value_json: any;
  value_image_url: string | null;
  updated_at: string;
}

const KIND_DESCRIPTIONS: Record<ContentBlock["kind"], string> = {
  text: "Short single-line copy",
  richtext: "Multi-line copy (paragraphs)",
  image: "Single image URL",
  image_list: "Ordered list of images (carousel)",
};

export default function AdminContentPage() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState<ContentBlock["kind"]>("text");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_blocks")
      .select("*")
      .order("key");
    if (error) toast.error(error.message);
    setBlocks((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveBlock = async (b: ContentBlock) => {
    setSavingKey(b.key);
    const { error } = await supabase
      .from("content_blocks")
      .update({
        value_text: b.value_text,
        value_json: b.value_json,
        value_image_url: b.value_image_url,
        updated_by: user?.id ?? null,
      })
      .eq("id", b.id);
    setSavingKey(null);
    if (error) return toast.error(error.message);
    invalidateContentBlock(b.key);
    toast.success(`Saved “${b.key}”`);
  };

  const createBlock = async () => {
    if (!newKey.trim()) return toast.error("Key required");
    const { error } = await supabase.from("content_blocks").insert({
      key: newKey.trim(),
      kind: newKind,
      value_text: newKind === "text" || newKind === "richtext" ? "" : null,
      value_json: newKind === "image_list" ? [] : null,
      value_image_url: newKind === "image" ? "" : null,
      updated_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setNewKey("");
    invalidateContentBlock(newKey.trim());
    load();
  };

  const deleteBlock = async (b: ContentBlock) => {
    if (!confirm(`Delete content block “${b.key}”?`)) return;
    const { error } = await supabase.from("content_blocks").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    invalidateContentBlock(b.key);
    load();
  };

  const filtered = blocks.filter((b) =>
    !filter || b.key.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Blocks</h1>
        <p className="text-muted-foreground">
          Edit marketing copy, hero images, partner-sensitive wording and carousels
          used across the site. Changes are live immediately for new visitors.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Create a new content block</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="newkey">Key (e.g. <code>landing.hero.title</code>)</Label>
            <Input id="newkey" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="landing.hero.title" />
          </div>
          <div>
            <Label htmlFor="kind">Kind</Label>
            <select id="kind"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as any)}>
              {Object.entries(KIND_DESCRIPTIONS).map(([k, d]) => (
                <option key={k} value={k}>{k} — {d}</option>
              ))}
            </select>
          </div>
          <Button onClick={createBlock}><Plus className="h-4 w-4 mr-1" /> Create</Button>
        </CardContent>
      </Card>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filter by key…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No content blocks yet. Create one above.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base font-mono">{b.key}</CardTitle>
                    <p className="text-xs text-muted-foreground">{KIND_DESCRIPTIONS[b.kind]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{b.kind}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => deleteBlock(b)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {b.kind === "text" && (
                  <Input
                    value={b.value_text ?? ""}
                    onChange={(e) => setBlocks((bs) => bs.map((x) => x.id === b.id ? { ...x, value_text: e.target.value } : x))}
                  />
                )}
                {b.kind === "richtext" && (
                  <Textarea
                    rows={4}
                    value={b.value_text ?? ""}
                    onChange={(e) => setBlocks((bs) => bs.map((x) => x.id === b.id ? { ...x, value_text: e.target.value } : x))}
                  />
                )}
                {b.kind === "image" && (
                  <div className="space-y-2">
                    <Input
                      placeholder="https://…"
                      value={b.value_image_url ?? ""}
                      onChange={(e) => setBlocks((bs) => bs.map((x) => x.id === b.id ? { ...x, value_image_url: e.target.value } : x))}
                    />
                    {b.value_image_url && (
                      <img src={b.value_image_url} alt={b.key}
                           className="max-h-40 rounded border object-cover" />
                    )}
                  </div>
                )}
                {b.kind === "image_list" && (
                  <ImageListEditor
                    value={Array.isArray(b.value_json) ? b.value_json : []}
                    onChange={(v) => setBlocks((bs) => bs.map((x) => x.id === b.id ? { ...x, value_json: v } : x))}
                  />
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => saveBlock(b)} disabled={savingKey === b.key}>
                    {savingKey === b.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageListEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const [draft, setDraft] = useState("");
  const items = value ?? [];
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder="https://image.url" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="button" size="sm" onClick={() => {
          if (!draft.trim()) return;
          onChange([...items, { url: draft.trim() }]);
          setDraft("");
        }}>
          <ImageIcon className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it: any, i: number) => (
          <div key={i} className="relative">
            <img src={it.url} alt="" className="h-20 w-28 object-cover rounded border" />
            <button
              type="button"
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            ><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
