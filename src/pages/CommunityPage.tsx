import { useState } from "react";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { CreateStoryDialog } from "@/components/community/CreateStoryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search } from "lucide-react";
import { STORY_CATEGORIES } from "@/lib/community-api";

export default function CommunityPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Community</h1>
              <p className="text-sm text-muted-foreground">Share stories, support pets, and connect</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-full shadow-md">
            <Plus className="h-4 w-4" /> Share Story
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by pet name, title, or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-full bg-muted border-none h-10"
        />
      </div>

      <CommunityFeed key={refreshKey} search={search} />
      <CreateStoryDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
