import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompassMenu } from "@/components/home/CompassMenu";
import { PublicFeed } from "@/components/home/PublicFeed";
import { SuggestedPets } from "@/components/home/SuggestedPets";
import { MobileSuggestedPets } from "@/components/home/MobileSuggestedPets";
import { PawPrint, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function HomePage() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

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
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <PawPrint className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold font-display text-foreground">Help A Pet</span>
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
          <aside className="w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
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
          <PublicFeed />
        </main>

        {/* Right Sidebar — Suggested Pets */}
        {!isMobile && (
          <aside className="w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
            <ScrollArea className="h-full">
              <SuggestedPets />
            </ScrollArea>
          </aside>
        )}
      </div>
    </div>
  );
}