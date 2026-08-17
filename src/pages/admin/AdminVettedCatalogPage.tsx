import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAllVettedProducts, fetchSyncConfig, fetchSyncRuns, setProductHidden, updateSyncConfig,
} from "@/lib/vetted-api";
import VettedCatalogImportDialog from "@/components/admin/VettedCatalogImportDialog";
import { UploadCloud, Search, Link2 } from "lucide-react";

export default function AdminVettedCatalogPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const { data: config } = useQuery({ queryKey: ["vetted-sync-config"], queryFn: fetchSyncConfig });
  const { data: runs = [] } = useQuery({ queryKey: ["vetted-sync-runs"], queryFn: fetchSyncRuns });
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["vetted-admin-products", search],
    queryFn: () => fetchAllVettedProducts(search),
  });

  const lastRun = runs[0];
  const visible = products.filter((p) => p.approved && !p.admin_hidden && !p.delisted_at).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vetted-admin-products"] });
    qc.invalidateQueries({ queryKey: ["vetted-sync-runs"] });
    qc.invalidateQueries({ queryKey: ["vetted-sync-config"] });
    qc.invalidateQueries({ queryKey: ["vetted-products"] });
  };

  async function toggleHidden(id: string, hidden: boolean) {
    try {
      await setProductHidden(id, hidden);
      refresh();
    } catch (e) {
      toast({ title: "Couldn't update the product", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function saveFeed() {
    try {
      await updateSyncConfig({ feed_url: feedUrl, notes });
      toast({ title: "Feed settings saved" });
      refresh();
    } catch (e) {
      toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Vetted catalogue</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Help a Pet mirrors the approved-product catalogue from Vetted. Vetted remains the source of truth for
            which products are approved — nothing is authored here.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <UploadCloud className="h-4 w-4 mr-1" /> Import catalogue
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Products live on Vetted</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{visible}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Last sync</CardDescription></CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {config?.last_success_at ? new Date(config.last_success_at).toLocaleString() : "Never synced"}
            </p>
            {lastRun && (
              <p className="text-xs text-muted-foreground mt-1">
                {lastRun.created_count} added · {lastRun.updated_count} updated · {lastRun.delisted_count} delisted
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Source</CardDescription></CardHeader>
          <CardContent>
            <p className="text-sm font-medium capitalize">{config?.adapter?.replace("_", " ") ?? "file import"}</p>
            <p className="text-xs text-muted-foreground mt-1">Automatic feed {config?.enabled ? "enabled" : "disabled"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Automatic feed (pending Vetted decision)</CardTitle>
          <CardDescription>
            The delivery method for the Vetted catalogue — API, feed URL, push, or replication — has not been
            confirmed yet, so automatic syncing stays switched off. Record the intended endpoint here when Vetted
            provides it; the import pipeline is already built to accept it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="feed-url">Feed URL</Label>
            <Input
              id="feed-url"
              placeholder="https://…"
              value={feedUrl ?? config?.feed_url ?? ""}
              onChange={(e) => setFeedUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="feed-notes">Notes</Label>
            <Textarea
              id="feed-notes"
              rows={2}
              value={notes ?? config?.notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border p-3 opacity-60">
            <div>
              <p className="text-sm font-medium">Enable automatic sync</p>
              <p className="text-xs text-muted-foreground">Unavailable until the integration method is confirmed.</p>
            </div>
            <Switch checked={false} disabled />
          </div>
          <Button variant="outline" onClick={saveFeed}>Save feed settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mirrored products</CardTitle>
          <CardDescription>Hide a product in an emergency; approval itself is controlled by Vetted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && products.length === 0 && (
            <p className="text-sm text-muted-foreground">No products mirrored yet. Import a catalogue export to get started.</p>
          )}
          <div className="divide-y">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.brand, p.store_name, p.category, p.price_text].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.source === "legacy_manual" && <Badge variant="outline" className="text-xs">Legacy</Badge>}
                  {p.delisted_at && <Badge variant="secondary" className="text-xs">Delisted</Badge>}
                  {!p.approved && !p.delisted_at && p.source !== "legacy_manual" && (
                    <Badge variant="secondary" className="text-xs">Not approved</Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Hidden</span>
                    <Switch checked={p.admin_hidden} onCheckedChange={(v) => toggleHidden(p.id, v)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Sync history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No imports yet.</p>}
          {runs.map((r) => (
            <div key={r.id} className="text-sm border rounded-md p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={r.status === "completed" ? "secondary" : "outline"}>{r.status.replace(/_/g, " ")}</Badge>
                <span className="text-muted-foreground text-xs">{new Date(r.started_at).toLocaleString()}</span>
                <span className="text-xs">{r.created_count} added · {r.updated_count} updated · {r.delisted_count} delisted · {r.skipped_count} skipped</span>
              </div>
              {r.errors?.length > 0 && (
                <p className="text-xs text-destructive mt-1">{r.errors.length} issue(s): {r.errors[0]}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <VettedCatalogImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={refresh} />
    </div>
  );
}
