import { Link } from "react-router-dom";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { CompassMenu } from "@/components/home/CompassMenu";
import { SuggestedPets } from "@/components/home/SuggestedPets";
import { MobileSuggestedPets } from "@/components/home/MobileSuggestedPets";
import { FurensicLibrary } from "@/components/furensic/FurensicLibrary";

export default function FurensicFilesPage() {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex h-14 items-center px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to feed"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="ml-3 flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold text-foreground">Furensic Files™</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {!isMobile && (
          <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-60 shrink-0">
            <ScrollArea className="h-full"><CompassMenu /></ScrollArea>
          </aside>
        )}

        <main className={`min-w-0 flex-1 ${isMobile ? "px-3 py-4 pb-24" : "border-x px-6 py-6"}`}>
          {isMobile && <MobileSuggestedPets />}

          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground">Furensic Files</h1>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              Investigative stories, videos, and podcast episodes on the cases behind the fur — watch
              and read right here, or open the original on YouTube whenever you prefer.
            </p>
          </div>

          <FurensicLibrary />
        </main>

        {!isMobile && (
          <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-72 shrink-0">
            <ScrollArea className="h-full"><SuggestedPets /></ScrollArea>
          </aside>
        )}
      </div>
    </div>
  );
}
