import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompassMenu } from "@/components/home/CompassMenu";
import { PublicFeed } from "@/components/home/PublicFeed";
import { SuggestedPets } from "@/components/home/SuggestedPets";
import { MobileSuggestedPets } from "@/components/home/MobileSuggestedPets";
import { User, Search } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STORY_CATEGORIES } from "@/lib/community-api";

export default function HomePage() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: profile } = useQuery({
    queryKey: ["headerProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-0">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoColor} alt="Help A Pet" className="object-contain" style={{ width: 100, height: 140 }} />
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {!isMobile && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </Button>
                )}
                <Link to="/dashboard/profile">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                </Link>
              </>
            ) : (
              <>
                {!isMobile && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/auth">Log In</Link>
                  </Button>
                )}
                <Button size="sm" asChild>
                  <Link to="/auth">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="max-w-7xl mx-auto flex">
        {/* Left Sidebar — Compass Menu */}
        {!isMobile && (
          <aside className="w-60 shrink-0 sticky top-0 h-screen">
            <ScrollArea className="h-full">
              <CompassMenu />
            </ScrollArea>
          </aside>
        )}

        {/* Center Feed */}
        <main className={`flex-1 min-w-0 ${isMobile ? 'px-2 py-3 pb-20' : 'border-x px-6 py-6'}`}>
          {!user && (
            <div className="mb-4 sm:mb-6 rounded-lg bg-primary/5 border border-primary/20 p-3 sm:p-4 text-center">
              <p className="text-sm text-foreground font-medium">
                🐾 Sign up to follow your favorite pets, like posts, and join the community!
              </p>
              <Button size="sm" className="mt-2" asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>
          )}
          {isMobile && <MobileSuggestedPets />}

          {/* Search & Category Filters */}
          <div className="space-y-3 mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stories..."
                className="pl-9 rounded-full"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Button
                size="sm"
                variant={category === "all" ? "default" : "outline"}
                className="rounded-full text-xs shrink-0"
                onClick={() => setCategory("all")}
              >
                All
              </Button>
              {STORY_CATEGORIES.filter((c) => c.value !== "general").map((c) => (
                <Button
                  key={c.value}
                  size="sm"
                  variant={category === c.value ? "default" : "outline"}
                  className="rounded-full text-xs shrink-0"
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          <PublicFeed search={search} category={category} />
        </main>

        {/* Right Sidebar — Suggested Pets */}
        {!isMobile && (
          <aside className="w-72 shrink-0 sticky top-0 h-screen">
            <ScrollArea className="h-full">
              <SuggestedPets />
            </ScrollArea>
          </aside>
        )}
      </div>
    </div>
  );
}