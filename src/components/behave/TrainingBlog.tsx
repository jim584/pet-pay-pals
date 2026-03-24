import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBehavePosts,
  createBehavePost,
  deleteBehavePost,
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
import { Plus, BookOpen, ArrowRight, Trash2, Clock } from "lucide-react";
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
  const { user } = useAuth();
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

  const handleSubmit = async () => {
    if (!user || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      let featured_image_url: string | undefined;
      if (form.imageFile) {
        featured_image_url = await uploadBehaveMedia(user.id, form.imageFile);
      }
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
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

  const handleDelete = async (id: string) => {
    try {
      await deleteBehavePost(id);
      qc.invalidateQueries({ queryKey: ["behave-posts"] });
      toast({ title: "Post deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
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
                <div className="aspect-video overflow-hidden" onClick={() => setReadPost(post)}>
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">{categoryLabel(post.category)}</Badge>
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
                    {user?.id === post.author_id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
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
    </div>
  );
}
