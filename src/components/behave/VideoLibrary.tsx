import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBehaveVideos,
  createBehaveVideo,
  deleteBehaveVideo,
  updateBehaveVideo,
  BEHAVE_PAGE_SIZE,
  BEHAVE_CATEGORIES,
  categoryLabel,
  type BehaveVideo,
} from "@/lib/behave-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function extractEmbedUrl(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return null;
}

function getThumbnail(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  return null;
}

export function VideoLibrary({
  search,
  category,
}: {
  search: string;
  category: string;
}) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", videoUrl: "", category: "general" });
  const [editItem, setEditItem] = useState<BehaveVideo | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", videoUrl: "", category: "general" });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["behave-videos", search, category],
      queryFn: ({ pageParam = 0 }) =>
        fetchBehaveVideos(pageParam, search, category || undefined),
      getNextPageParam: (last, all) =>
        last.length === BEHAVE_PAGE_SIZE ? all.length : undefined,
      initialPageParam: 0,
    });

  const videos = data?.pages.flat() ?? [];
  const canManage = (vid: BehaveVideo) => isAdmin || user?.id === vid.uploaded_by;

  const handleSubmit = async () => {
    if (!user || !form.title.trim() || !form.videoUrl.trim()) return;
    const embedUrl = extractEmbedUrl(form.videoUrl);
    if (!embedUrl) {
      toast({ title: "Invalid URL", description: "Please paste a YouTube or Vimeo link.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createBehaveVideo({
        uploaded_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        video_url: embedUrl,
        thumbnail_url: getThumbnail(form.videoUrl) || undefined,
        category: form.category,
      });
      qc.invalidateQueries({ queryKey: ["behave-videos"] });
      setOpen(false);
      setForm({ title: "", description: "", videoUrl: "", category: "general" });
      toast({ title: "Video added!" });
    } catch {
      toast({ title: "Failed to add video", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBehaveVideo(deleteId);
      qc.invalidateQueries({ queryKey: ["behave-videos"] });
      toast({ title: "Video deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (vid: BehaveVideo) => {
    setEditItem(vid);
    setEditForm({ title: vid.title, description: vid.description || "", videoUrl: vid.video_url, category: vid.category });
  };

  const handleEditSubmit = async () => {
    if (!editItem || !editForm.title.trim()) return;
    setEditSaving(true);
    try {
      const updates: any = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        category: editForm.category,
      };
      if (editForm.videoUrl !== editItem.video_url) {
        const embedUrl = extractEmbedUrl(editForm.videoUrl);
        if (!embedUrl) {
          toast({ title: "Invalid URL", variant: "destructive" });
          setEditSaving(false);
          return;
        }
        updates.video_url = embedUrl;
        updates.thumbnail_url = getThumbnail(editForm.videoUrl) || undefined;
      }
      await updateBehaveVideo(editItem.id, updates);
      qc.invalidateQueries({ queryKey: ["behave-videos"] });
      setEditItem(null);
      toast({ title: "Video updated!" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      {user && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Video
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && videos.length === 0 && (
        <div className="text-center py-16">
          <Video className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No videos yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {user ? "Share the first training video!" : "Check back soon."}
          </p>
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((vid) => (
            <Card key={vid.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {playingId === vid.id ? (
                  <iframe
                    src={vid.video_url}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={vid.title}
                  />
                ) : (
                  <button
                    className="w-full h-full flex items-center justify-center group"
                    onClick={() => setPlayingId(vid.id)}
                  >
                    {vid.thumbnail_url ? (
                      <img src={vid.thumbnail_url} alt={vid.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Video className="h-12 w-12 text-muted-foreground/50" />
                    )}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-primary text-primary-foreground rounded-full p-3">
                        <Video className="h-6 w-6" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-medium text-sm text-foreground line-clamp-1">{vid.title}</h3>
                  {canManage(vid) && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(vid)}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteId(vid.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                {vid.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{vid.description}</p>
                )}
                <Badge variant="secondary" className="text-[10px]">{categoryLabel(vid.category)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="text-center mt-6">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {/* Add Video Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Training Video</DialogTitle>
            <DialogDescription>Paste a YouTube or Vimeo URL to share a training video.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Leash reactivity fix" />
            </div>
            <div className="space-y-2">
              <Label>Video URL *</Label>
              <Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {BEHAVE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={saving || !form.title.trim() || !form.videoUrl.trim()} onClick={handleSubmit}>
              {saving ? "Saving..." : "Add Video"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Video Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
            <DialogDescription>Update video details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input value={editForm.videoUrl} onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {BEHAVE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={editSaving || !editForm.title.trim()} onClick={handleEditSubmit}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
