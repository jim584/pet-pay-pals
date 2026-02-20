import { useState } from "react";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { CreateStoryDialog } from "@/components/community/CreateStoryDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function CommunityPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Community</h1>
          <p className="text-muted-foreground mt-1">Share stories, support pets, and connect</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Share Story
        </Button>
      </div>
      <CommunityFeed key={refreshKey} />
      <CreateStoryDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
