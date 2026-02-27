import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompassMenu } from "@/components/home/CompassMenu";
import { PublicFeed } from "@/components/home/PublicFeed";
import { SuggestedPets } from "@/components/home/SuggestedPets";
import { PawPrint, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function HomePage() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

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
            <span className="text-lg font-bold font-display text-foreground hidden sm:inline">Help A Pet</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth">Log In</Link>
                </Button>
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
        <main className="flex-1 min-w-0 border-x px-4 py-6 sm:px-6">
          {!user && (
            <div className="mb-6 rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
              <p className="text-sm text-foreground font-medium">
                🐾 Sign up to follow your favorite pets, like posts, and join the community!
              </p>
              <Button size="sm" className="mt-2" asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>
          )}
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
