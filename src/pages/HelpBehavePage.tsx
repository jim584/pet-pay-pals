import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Dog, Search, ShieldCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { BEHAVE_CATEGORIES, categoryLabel } from "@/lib/behave-api";
import { ImageGallery } from "@/components/behave/ImageGallery";
import { VideoLibrary } from "@/components/behave/VideoLibrary";
import { TrainingBlog } from "@/components/behave/TrainingBlog";

export default function HelpBehavePage() {
  const isMobile = useIsMobile();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => setDebouncedSearch(value), 400));
  };

  const allCategories = ["", ...BEHAVE_CATEGORIES];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center h-14 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
            <div className="flex items-center gap-2 ml-3">
              <Dog className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold font-display text-foreground">Help A Pet Behave™</span>
              {isAdmin && (
                <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </Badge>
              )}
            </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto ${isMobile ? "px-3 py-4 pb-24" : "px-6 py-6"}`}>
        {/* Hero */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 mb-6 text-center">
          <h1 className="text-2xl font-bold font-display text-foreground">Training & Behavior Resources</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-lg mx-auto">
            Browse images, watch training videos, and read expert-backed articles to help your pet behave better.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {allCategories.map((c) => (
            <Badge
              key={c || "all"}
              variant={category === c ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory(c)}
            >
              {c ? categoryLabel(c) : "All"}
            </Badge>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="blog">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
          </TabsList>

          <TabsContent value="images">
            <ImageGallery search={debouncedSearch} category={category} />
          </TabsContent>
          <TabsContent value="videos">
            <VideoLibrary search={debouncedSearch} category={category} />
          </TabsContent>
          <TabsContent value="blog">
            <TrainingBlog search={debouncedSearch} category={category} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
