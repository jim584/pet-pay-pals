import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PawPrint, Sparkles, Loader2 } from "lucide-react";
import { PetStory, fetchStories, STORIES_PAGE_SIZE, StoryCategory } from "@/lib/community-api";
import { StoryCard } from "./StoryCard";

function StorySkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="mx-3 h-52 rounded-xl" />
      <div className="px-4 py-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="px-4 pb-4 flex gap-3">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </Card>
  );
}

export function CommunityFeed({ search = "", category = "" }: { search?: string; category?: string }) {
  const [stories, setStories] = useState<PetStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStories(0);
      setStories(data);
      setPage(0);
      setHasMore(data.length >= STORIES_PAGE_SIZE);
    } catch { } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchStories(nextPage);
      setStories((prev) => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(data.length >= STORIES_PAGE_SIZE);
    } catch { } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const q = search.toLowerCase().trim();
  const filtered = stories.filter((s) => {
    if (category && s.category !== category) return false;
    if (q) {
      return (
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        (s as any).pets?.name?.toLowerCase().includes(q) ||
        (s as any).profiles?.full_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });
  const isFiltering = !!q || !!category;

  if (loading) {
    return (
      <div className="space-y-5">
        {[1, 2, 3].map((i) => <StorySkeleton key={i} />)}
      </div>
    );
  }

  if (filtered.length === 0 && !isFiltering) {
    return (
      <Card className="rounded-2xl border-dashed border-2 border-border/60">
        <CardContent className="p-12 text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <PawPrint className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold font-display flex items-center justify-center gap-1.5">
              <Sparkles className="h-4 w-4 text-accent" />
              No stories yet
            </p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Be the first to share your pet's story and connect with the community!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0 && isFiltering) {
    return (
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-10 text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <PawPrint className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No stories match "<span className="font-medium text-foreground">{q}</span>"</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {filtered.map((story) => (
        <StoryCard key={story.id} story={story} onRefresh={loadInitial} />
      ))}
      {hasMore && !q && (
        <div className="flex justify-center pt-2 pb-4">
          <Button
            variant="outline"
            className="rounded-full gap-2"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
