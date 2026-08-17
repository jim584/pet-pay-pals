import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteFurensicEntry,
  fetchFurensicEntries,
  type FurensicEntry,
  type FurensicKind,
} from "@/lib/furensic-api";
import { FurensicEntryCard } from "./FurensicEntryCard";
import { FurensicEditorDialog } from "./FurensicEditorDialog";

const TABS: { value: FurensicKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blog", label: "Blog" },
  { value: "video", label: "Video" },
  { value: "podcast", label: "Podcast" },
];

export function FurensicLibrary({ includeDrafts = false }: { includeDrafts?: boolean }) {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "content_editor";
  const [kind, setKind] = useState<FurensicKind | "all">("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FurensicEntry | null>(null);
  const [deleting, setDeleting] = useState<FurensicEntry | null>(null);

  const showDrafts = includeDrafts && canManage;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["furensic-entries", kind, search, showDrafts],
    queryFn: () => fetchFurensicEntries({ kind, search, includeDrafts: showDrafts }),
  });

  const entries = data ?? [];

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteFurensicEntry(deleting.id);
      toast({ title: "Entry deleted" });
      refetch();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Furensic Files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button
            className="gap-1.5"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New entry
          </Button>
        )}
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as FurensicKind | "all")}>
        <TabsList className="w-full justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No Furensic Files content yet.
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <FurensicEntryCard
              key={entry.id}
              entry={entry}
              canManage={canManage}
              onEdit={(e) => {
                setEditing(e);
                setEditorOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <FurensicEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entry={editing}
        onSaved={refetch}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will be removed from Furensic Files. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
