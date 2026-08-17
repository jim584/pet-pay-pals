import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchVettedProducts, fetchLastCatalogSync } from "@/lib/vetted-api";
import { ProductCard } from "@/components/vetted/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, ShoppingBag, Store, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

const CATEGORY_TABS = [
  { value: "all", label: "All" },
  { value: "food", label: "🍖 Food" },
  { value: "toys", label: "🧸 Toys" },
  { value: "health", label: "💊 Health" },
  { value: "accessories", label: "🎀 Accessories" },
];

export default function VettedPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const searchTimeout = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout[0]) clearTimeout(searchTimeout[0]);
    searchTimeout[0] = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["vetted-products", category, debouncedSearch],
      queryFn: ({ pageParam = 0 }) =>
        fetchVettedProducts(pageParam, category, debouncedSearch),
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === 12 ? allPages.length : undefined,
      initialPageParam: 0,
    });

  const products = data?.pages.flat() ?? [];

  const { data: lastSynced } = useQuery({
    queryKey: ["vetted-last-sync"],
    queryFn: fetchLastCatalogSync,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold font-display text-foreground">Vetted™</span>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1 text-xs"><BadgeCheck className="h-3 w-3" /> Vetted-approved</Badge>
        </div>
      </header>

      <main className={`max-w-6xl mx-auto ${isMobile ? "px-3 py-4 pb-24" : "px-6 py-6"}`}>
        {/* Hero */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 mb-6 text-center">
          <h1 className="text-2xl font-bold font-display text-foreground">
            Trusted Pet Products
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-lg mx-auto">
            Every product here has been approved through Vetted™. Help a Pet displays the Vetted catalogue &mdash; approval is
            determined by Vetted, not by Help a Pet. Tap "Shop Now" to buy directly from the retailer.
          </p>
        </div>

        {lastSynced && (
          <p className="text-xs text-muted-foreground text-center -mt-3 mb-4">
            Catalogue last synced from Vetted on {new Date(lastSynced).toLocaleDateString()}
          </p>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, brands, or stores..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category tabs */}
        <Tabs value={category} onValueChange={setCategory} className="mb-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            {CATEGORY_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-lg border overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-8 w-24 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-16">
            <Store className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">The Vetted catalogue hasn't been synced yet</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Approved products appear here as soon as the catalogue is received from Vetted.
            </p>
          </div>
        )}

        {/* Product grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
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
