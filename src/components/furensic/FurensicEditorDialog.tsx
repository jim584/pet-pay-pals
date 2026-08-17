import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  FURENSIC_KINDS,
  createFurensicEntry,
  parseMediaUrl,
  updateFurensicEntry,
  type FurensicEntry,
  type FurensicKind,
} from "@/lib/furensic-api";

const EMPTY = {
  kind: "blog" as FurensicKind,
  title: "",
  summary: "",
  body: "",
  cover_image_url: "",
  media_url: "",
  duration_label: "",
  tags: "",
  is_published: true,
  sort_order: 0,
};

export function FurensicEditorDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: FurensicEntry | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      entry
        ? {
            kind: entry.kind,
            title: entry.title,
            summary: entry.summary ?? "",
            body: entry.body ?? "",
            cover_image_url: entry.cover_image_url ?? "",
            media_url: entry.media_url ?? "",
            duration_label: entry.duration_label ?? "",
            tags: (entry.tags ?? []).join(", "),
            is_published: entry.is_published,
            sort_order: entry.sort_order,
          }
        : EMPTY,
    );
  }, [open, entry]);

  const preview = form.media_url ? parseMediaUrl(form.media_url) : null;

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "A title is required", variant: "destructive" });
      return;
    }
    if (form.media_url.trim() && !preview) {
      toast({
        title: "That media link isn't valid",
        description: "Paste a full YouTube, Vimeo, Spotify or https link.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        kind: form.kind,
        title: form.title,
        summary: form.summary,
        body: form.body,
        cover_image_url: form.cover_image_url,
        media_url: form.media_url,
        duration_label: form.duration_label,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        is_published: form.is_published,
        sort_order: Number(form.sort_order) || 0,
      };
      if (entry) await updateFurensicEntry(entry.id, payload);
      else await createFurensicEntry(payload, user?.id);
      toast({ title: entry ? "Entry updated" : "Entry published" });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({
        title: "Could not save entry",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Furensic Files entry" : "New Furensic Files entry"}</DialogTitle>
          <DialogDescription>
            Publish a blog post, video, or podcast episode. Paste a YouTube link and it plays inside Help a Pet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as FurensicKind }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FURENSIC_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="furensic-order">Pin order (higher first)</Label>
              <Input
                id="furensic-order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="furensic-title">Title</Label>
            <Input
              id="furensic-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="furensic-media">Video / podcast link (optional)</Label>
            <Input
              id="furensic-media"
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.media_url}
              onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
            />
            {form.media_url && (
              <p className="text-xs text-muted-foreground">
                {preview?.embedUrl
                  ? "Plays inside Help a Pet, with a link out to the original."
                  : preview
                    ? "Link saved — it will show as an outbound link (no in-app player)."
                    : "Not a recognised link yet."}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="furensic-cover">Cover image URL (optional)</Label>
              <Input
                id="furensic-cover"
                value={form.cover_image_url}
                onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="furensic-duration">Duration label (optional)</Label>
              <Input
                id="furensic-duration"
                placeholder="24 min"
                value={form.duration_label}
                onChange={(e) => setForm((f) => ({ ...f, duration_label: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="furensic-summary">Summary</Label>
            <Textarea
              id="furensic-summary"
              rows={2}
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="furensic-body">Body (blog content)</Label>
            <Textarea
              id="furensic-body"
              rows={6}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="furensic-tags">Tags (comma separated)</Label>
            <Input
              id="furensic-tags"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="furensic-published">Published</Label>
              <p className="text-xs text-muted-foreground">Drafts are only visible to admins and editors.</p>
            </div>
            <Switch
              id="furensic-published"
              checked={form.is_published}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : entry ? "Save changes" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
