import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAdoptionListings } from "@/lib/adoption-api";
import { AdoptionCard } from "@/components/adoption/AdoptionCard";
import { CreateAdoptionDialog } from "@/components/adoption/CreateAdoptionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PawPrint, ArrowLeft, Heart, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const SPECIES_TABS = [
  { value: "all", label: "All" },
  { value: "dog", label: "🐕 Dogs" },
  { value: "cat", label: "🐈 Cats" },
  { value: "other", label: "🐾 Others" },
];

export default function HelpForeverPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [species, setSpecies] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
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
    queryKey: ["adoption-listings", species, debouncedSearch],
    queryFn: ({ pageParam = 0 }) => fetchAdoptionListings(pageParam, species, debouncedSearch),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 8 ? allPages.length : undefined,
    initialPageParam: 0,
  });

  const listings = data?.pages.flat() ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold font-display text-foreground">Help A Pet Forever™</span>
            </div>
          </div>
          {user && <CreateAdoptionDialog />}
        </div>
      </header>

      <main className={`max-w-4xl mx-auto ${isMobile ? "px-3 py-4 pb-24" : "px-6 py-6"}`}>
        {/* Hero banner */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 mb-6 text-center">
          <h1 className="text-2xl font-bold font-display text-foreground">Adopt a Pet, Change a Life</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-md mx-auto">
            Browse dogs, cats, and other animals looking for their forever home. Every pet deserves love.
          </p>
        </div>

        {/* Filter tabs */}
        <Tabs value={species} onValueChange={setSpecies} className="mb-6">
          <TabsList className="w-full justify-start">
            {SPECIES_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border overflow-hidden sm:flex">
                <Skeleton className="aspect-[4/3] sm:aspect-auto sm:w-56 sm:shrink-0 w-full sm:h-auto h-48" />
                <div className="p-4 space-y-2 flex-1">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && listings.length === 0 && (
          <div className="text-center py-16">
            <PawPrint className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">No pets available yet</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {user ? "Be the first to post an adoption listing!" : "Check back soon for pets looking for homes."}
            </p>
          </div>
        )}

        {/* Listings grid */}
        {listings.length > 0 && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            {listings.map((listing) => (
              <AdoptionCard key={listing.id} listing={listing} />
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
    </div>
  );
}
