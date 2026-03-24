import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBehavePosts,
  createBehavePost,
  deleteBehavePost,
  updateBehavePost,
  uploadBehaveMedia,
  BEHAVE_PAGE_SIZE,
  BEHAVE_CATEGORIES,
  categoryLabel,
  type BehavePost,
} from "@/lib/behave-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { Plus, BookOpen, ArrowRight, Trash2, Pencil, Clock, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp,.gif";

export function TrainingBlog({
  search,
  category,
}: {
  search: string;
  category: string;
}) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [readPost, setReadPost] = useState<BehavePost | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "training-tips",
    tags: "",
    imageFile: null as File | null,
  });
  const [editPost, setEditPost] = useState<BehavePost | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "training-tips",
    tags: "",
    is_published: true,
    imageFile: null as File | null,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["behave-posts", search, category],
      queryFn: ({ pageParam = 0 }) =>
        fetchBehavePosts(pageParam, search, category || undefined),
      getNextPageParam: (last, all) =>
        last.length === BEHAVE_PAGE_SIZE ? all.length : undefined,
      initialPageParam: 0,
    });

  const posts = data?.pages.flat() ?? [];
  const canManage = (post: BehavePost) => isAdmin || user?.id === post.author_id;

  const handleSubmit = async () => {
    if (!user || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      let featured_image_url: string | undefined;
      if (form.imageFile) {
        featured_image_url = await uploadBehaveMedia(user.id, form.imageFile);
      }
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await createBehavePost({
        author_id: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
        excerpt: form.excerpt.trim() || form.content.trim().slice(0, 160),
        featured_image_url,
        category: form.category,
        tags,
      });
      qc.invalidateQueries({ queryKey: ["behave-posts"] });
      setCreateOpen(false);
      setForm({ title: "", content: "", excerpt: "", category: "training-tips", tags: "", imageFile: null });
      toast({ title: "Post published!" });
    } catch {
      toast({ title: "Failed to create post", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBehavePost(deleteId);
      qc.invalidateQueries({ queryKey: ["behave-posts"] });
      toast({ title: "Post deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (post: BehavePost) => {
    setEditPost(post);
    setEditForm({
      title: post.title,
      content: post.content,
      excerpt: post.excerpt || "",
      category: post.category,
      tags: (post.tags || []).join(", "),
      is_published: post.is_published,
      imageFile: null,
    });
  };

  const handleEditSubmit = async () => {
    if (!editPost || !editForm.title.trim() || !editForm.content.trim()) return;
    setEditSaving(true);
    try {
      let featured_image_url: string | undefined;
      if (editForm.imageFile && user) {
        featured_image_url = await uploadBehaveMedia(user.id, editForm.imageFile);
      }
      const tags = editForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await updateBehavePost(editPost.id, {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        excerpt: editForm.excerpt.trim() || editForm.content.trim().slice(0, 160),
        category: editForm.category,
        tags,
        is_published: editForm.is_published,
        ...(featured_image_url ? { featured_image_url } : {}),
      });
      qc.invalidateQueries({ queryKey: ["behave-posts"] });
      setEditPost(null);
      toast({ title: "Post updated!" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const readTime = (content: string) => Math.max(1, Math.ceil(content.split(/\s+/).length / 200));

  return (
    <div>
      {user && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Post
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 max-w-2xl mx-auto">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border p-4 space-y-3">
              <Skeleton className="aspect-video rounded-lg" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No blog posts yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {user ? "Write the first training article!" : "Check back soon."}
          </p>
        </div>
      )}

      {posts.length > 0 && (
        <div className="grid grid-cols-1 gap-5 max-w-2xl mx-auto">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
              {post.featured_image_url && (
                <div className="aspect-video overflow-hidden relative" onClick={() => setReadPost(post)}>
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {!post.is_published && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <EyeOff className="h-3 w-3" /> Draft
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{categoryLabel(post.category)}</Badge>
                    {!post.is_published && !post.featured_image_url && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <EyeOff className="h-3 w-3" /> Draft
                      </Badge>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {readTime(post.content)} min read
                  </span>
                </div>
                <h3
                  className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors"
                  onClick={() => setReadPost(post)}
                >
                  {post.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {post.excerpt || post.content.slice(0, 160)}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {post.profiles?.full_name ?? "Unknown"} · {format(new Date(post.created_at), "MMM d, yyyy")}
                  </span>
                  <div className="flex items-center gap-1">
                    {canManage(post) && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(post); }}>
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteId(post.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => setReadPost(post)}>
                      Read More <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
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

      {/* Read Post Dialog */}
      <Dialog open={!!readPost} onOpenChange={(o) => !o && setReadPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{readPost?.title}</DialogTitle>
            <DialogDescription>
              {readPost?.profiles?.full_name ?? "Unknown"} · {readPost ? format(new Date(readPost.created_at), "MMM d, yyyy") : ""}
            </DialogDescription>
          </DialogHeader>
          {readPost?.featured_image_url && (
            <img src={readPost.featured_image_url} alt={readPost.title} className="w-full rounded-lg aspect-video object-cover" />
          )}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="secondary">{readPost ? categoryLabel(readPost.category) : ""}</Badge>
            {readPost?.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {readPost?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Post Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Training Post</DialogTitle>
            <DialogDescription>Share training methods, tips, and guidance with the community.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 5 Steps to Stop Leash Pulling" />
            </div>
            <div className="space-y-2">
              <Label>Featured Image</Label>
              <Input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] ?? null })} />
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write your article content..." rows={8} />
            </div>
            <div className="space-y-2">
              <Label>Excerpt</Label>
              <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Short summary (auto-generated if left blank)" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BEHAVE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Comma-separated: e.g. leash, reactivity, tips" />
            </div>
            <Button className="w-full" disabled={saving || !form.title.trim() || !form.content.trim()} onClick={handleSubmit}>
              {saving ? "Publishing..." : "Publish Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Post Dialog */}
      <Dialog open={!!editPost} onOpenChange={(o) => !o && setEditPost(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Update the training post.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Replace Featured Image</Label>
              <Input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={(e) => setEditForm({ ...editForm, imageFile: e.target.files?.[0] ?? null })} />
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={8} />
            </div>
            <div className="space-y-2">
              <Label>Excerpt</Label>
              <Textarea value={editForm.excerpt} onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BEHAVE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Published</Label>
                <Switch checked={editForm.is_published} onCheckedChange={(v) => setEditForm({ ...editForm, is_published: v })} />
              </div>
            )}
            <Button className="w-full" disabled={editSaving || !editForm.title.trim() || !editForm.content.trim()} onClick={handleEditSubmit}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
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
