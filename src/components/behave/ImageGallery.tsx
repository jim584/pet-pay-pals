import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBehaveImages,
  createBehaveImage,
  deleteBehaveImage,
  uploadBehaveMedia,
  BEHAVE_PAGE_SIZE,
  BEHAVE_CATEGORIES,
  categoryLabel,
  type BehaveImage,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp,.gif";

export function ImageGallery({
  search,
  category,
}: {
  search: string;
  category: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "general", file: null as File | null });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["behave-images", search, category],
      queryFn: ({ pageParam = 0 }) =>
        fetchBehaveImages(pageParam, search, category || undefined),
      getNextPageParam: (last, all) =>
        last.length === BEHAVE_PAGE_SIZE ? all.length : undefined,
      initialPageParam: 0,
    });

  const images = data?.pages.flat() ?? [];

  const handleSubmit = async () => {
    if (!user || !form.file || !form.title.trim()) return;
    setUploading(true);
    try {
      const url = await uploadBehaveMedia(user.id, form.file);
      await createBehaveImage({
        uploaded_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        image_url: url,
        category: form.category,
      });
      qc.invalidateQueries({ queryKey: ["behave-images"] });
      setOpen(false);
      setForm({ title: "", description: "", category: "general", file: null });
      toast({ title: "Image uploaded!" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBehaveImage(id);
      qc.invalidateQueries({ queryKey: ["behave-images"] });
      toast({ title: "Image deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div>
      {user && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Upload Image
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && images.length === 0 && (
        <div className="text-center py-16">
          <ImageIcon className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No images yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {user ? "Upload the first training image!" : "Check back soon."}
          </p>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden group">
              <div className="aspect-square overflow-hidden">
                <img
                  src={img.image_url}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-medium text-sm text-foreground line-clamp-1">{img.title}</h3>
                  {user?.id === img.uploaded_by && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDelete(img.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                {img.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{img.description}</p>
                )}
                <Badge variant="secondary" className="text-[10px]">{categoryLabel(img.category)}</Badge>
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

      {/* Upload Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Training Image</DialogTitle>
            <DialogDescription>Share a helpful training image with the community.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Proper leash grip" />
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
            <div className="space-y-2">
              <Label>Image *</Label>
              <Input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
            </div>
            <Button className="w-full" disabled={uploading || !form.title.trim() || !form.file} onClick={handleSubmit}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
