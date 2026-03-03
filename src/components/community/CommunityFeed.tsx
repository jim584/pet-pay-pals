import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PawPrint, Sparkles } from "lucide-react";
import { PetStory, fetchStories } from "@/lib/community-api";
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

export function CommunityFeed({ search = "" }: { search?: string }) {
  const [stories, setStories] = useState<PetStory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setStories(await fetchStories());
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? stories.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        (s as any).pets?.name?.toLowerCase().includes(q) ||
        (s as any).profiles?.full_name?.toLowerCase().includes(q)
      )
    : stories;

  if (loading) {
    return (
      <div className="space-y-5">
        {[1, 2, 3].map((i) => <StorySkeleton key={i} />)}
      </div>
    );
  }

  if (filtered.length === 0 && !q) {
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

  if (filtered.length === 0 && q) {
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
        <StoryCard key={story.id} story={story} onRefresh={load} />
      ))}
    </div>
  );
}
