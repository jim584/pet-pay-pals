import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProtectionStories, PROTECTION_PAGE_SIZE } from "@/lib/protection-api";
import { StoryCard } from "@/components/community/StoryCard";
import { CreateStoryDialog } from "@/components/community/CreateStoryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldAlert, Search, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompassMenu } from "@/components/home/CompassMenu";
import { SuggestedPets } from "@/components/home/SuggestedPets";
import { MobileSuggestedPets } from "@/components/home/MobileSuggestedPets";

export default function HelpProtectPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const searchTimeout = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout[0]) clearTimeout(searchTimeout[0]);
    searchTimeout[0] = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["protection-stories", debouncedSearch],
    queryFn: ({ pageParam = 0 }) => fetchProtectionStories(pageParam, debouncedSearch),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PROTECTION_PAGE_SIZE ? allPages.length : undefined,
    initialPageParam: 0,
  });

  const stories = data?.pages.flat() ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["protection-stories"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <span className="text-lg font-bold font-display text-foreground">Help A Pet Protect™</span>
            </div>
          </div>
          {user && (
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Report
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {!isMobile && (
          <aside className="w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
            <ScrollArea className="h-full">
              <CompassMenu />
            </ScrollArea>
          </aside>
        )}

        <main className={`flex-1 min-w-0 ${isMobile ? "px-3 py-4 pb-24" : "border-x px-6 py-6"}`}>
          {isMobile && <MobileSuggestedPets />}

          {/* Hero banner */}
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-5 mb-6 text-center">
            <h1 className="text-2xl font-bold font-display text-foreground">Report & Raise Awareness</h1>
            <p className="text-muted-foreground mt-1 text-sm max-w-md mx-auto">
              Share stories of animal abuse, neglect, or mistreatment. Together we can protect every pet.
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search protection stories..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && stories.length === 0 && (
            <div className="text-center py-16">
              <ShieldAlert className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground">No protection stories yet</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {user ? "Be the first to report a case and raise awareness." : "Check back soon for updates."}
              </p>
            </div>
          )}

          {/* Feed */}
          {stories.length > 0 && (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} onRefresh={handleRefresh} />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasNextPage && (
            <div className="text-center mt-6">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </main>

        {!isMobile && (
          <aside className="w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
            <ScrollArea className="h-full">
              <SuggestedPets />
            </ScrollArea>
          </aside>
        )}
      </div>

      {user && (
        <CreateStoryDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={handleRefresh}
          defaultCategory="protection"
        />
      )}
    </div>
  );
}
