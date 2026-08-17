import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  fetchImportRuns, fetchLicenseSources, searchVetLicenses, stalenessDays, syncLicenseState,
  type VetLicenseImportRun, type VetLicenseRecord, type VetLicenseSource,
} from "@/lib/vet-licenses-api";
import VetLicenseImportDialog from "@/components/admin/VetLicenseImportDialog";
import { AlertTriangle, Database, ExternalLink, RefreshCw, Search, Settings2 } from "lucide-react";

const METHOD_LABEL: Record<string, string> = {
  api: "API",
  bulk_file: "File URL",
  manual_upload: "Admin upload",
  none_yet: "Not configured",
};

export default function AdminVetLicenseDatabasePage() {
  const { toast } = useToast();
  const [sources, setSources] = useState<VetLicenseSource[]>([]);
  const [runs, setRuns] = useState<VetLicenseImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<VetLicenseSource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VetLicenseRecord[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([fetchLicenseSources(), fetchImportRuns(undefined, 40)]);
      setSources(s);
      setRuns(r);
    } catch (e) {
      toast({ title: "Could not load license database", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return; }
      try { setResults(await searchVetLicenses(query.trim(), null, 25)); }
      catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const totals = useMemo(() => ({
    records: sources.reduce((a, s) => a + (s.record_count ?? 0), 0),
    loaded: sources.filter((s) => (s.record_count ?? 0) > 0).length,
    automated: sources.filter((s) => s.auto_sync_enabled).length,
    stale: sources.filter((s) => {
      const d = stalenessDays(s);
      return (s.record_count ?? 0) > 0 && d !== null && d > s.refresh_cadence_days;
    }).length,
  }), [sources]);

  const visible = sources.filter((s) =>
    !filter.trim() ||
    s.state_name.toLowerCase().includes(filter.toLowerCase()) ||
    s.state_code.toLowerCase() === filter.trim().toLowerCase(),
  );

  async function handleSync(s: VetLicenseSource) {
    setSyncing(s.state_code);
    try {
      await syncLicenseState(s.state_code);
      toast({ title: `${s.state_name} sync finished` });
      await load();
    } catch (e) {
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> Veterinarian License Database
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Active, standard veterinary licenses imported from each state's official licensing source.
          Technician, specialty, and other credential types are excluded at import.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Active licenses held", value: totals.records.toLocaleString() },
          { label: "Jurisdictions loaded", value: `${totals.loaded} / ${sources.length}` },
          { label: "Automatic syncs on", value: totals.automated },
          { label: "Stale (past cadence)", value: totals.stale },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="states">
        <TabsList>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="runs">Import history</TabsTrigger>
          <TabsTrigger value="search">Record search</TabsTrigger>
        </TabsList>

        <TabsContent value="states" className="space-y-3">
          <Input
            placeholder="Filter by state…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">State</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Records</th>
                    <th className="p-3">Last sync</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!loading && visible.map((s) => {
                    const days = stalenessDays(s);
                    const stale = (s.record_count ?? 0) > 0 && days !== null && days > s.refresh_cadence_days;
                    return (
                      <tr key={s.state_code} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{s.state_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {s.authority}
                            {s.source_url && (
                              <a href={s.source_url} target="_blank" rel="noreferrer" className="inline-flex">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{METHOD_LABEL[s.import_method]}</Badge>
                          {s.auto_sync_enabled && <Badge className="ml-1" variant="secondary">auto</Badge>}
                        </td>
                        <td className="p-3">{(s.record_count ?? 0).toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">
                          {s.last_success_at ? `${days}d ago` : "never"}
                        </td>
                        <td className="p-3">
                          {s.last_error ? (
                            <span className="text-destructive inline-flex items-center gap-1 text-xs">
                              <AlertTriangle className="h-3 w-3" /> {s.last_error.slice(0, 60)}
                            </span>
                          ) : stale ? (
                            <Badge variant="destructive">stale</Badge>
                          ) : (s.record_count ?? 0) > 0 ? (
                            <Badge variant="secondary">current</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">no data yet</span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {(s.import_method === "api" || s.import_method === "bulk_file") && (
                            <Button
                              size="sm" variant="ghost"
                              disabled={syncing === s.state_code}
                              onClick={() => handleSync(s)}
                            >
                              <RefreshCw className={`h-4 w-4 ${syncing === s.state_code ? "animate-spin" : ""}`} />
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => { setActive(s); setDialogOpen(true); }}
                          >
                            <Settings2 className="h-4 w-4 mr-1" /> Import / configure
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Started</th>
                    <th className="p-3">State</th>
                    <th className="p-3">Trigger</th>
                    <th className="p-3">Read / kept</th>
                    <th className="p-3">Filtered</th>
                    <th className="p-3">Applied</th>
                    <th className="p-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No imports yet.</td></tr>
                  )}
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-3 whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</td>
                      <td className="p-3">{r.state_code}</td>
                      <td className="p-3 text-muted-foreground">{r.trigger_source}</td>
                      <td className="p-3">{r.rows_read} / {r.rows_kept}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        status {r.rows_filtered_status} · type {r.rows_filtered_type} · invalid {r.rows_invalid}
                      </td>
                      <td className="p-3 text-xs">
                        +{r.rows_inserted} · ~{r.rows_updated} · −{r.rows_deactivated}
                      </td>
                      <td className="p-3">
                        <Badge variant={r.status === "success" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>
                          {r.status}
                        </Badge>
                        {r.error_message && (
                          <div className="text-xs text-destructive mt-1 max-w-xs">{r.error_message}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Search all states
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Veterinarian name, license number, or city…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="divide-y">
                {results.map((r) => (
                  <div key={r.id} className="py-2 text-sm">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.state} #{r.license_number} · {[r.city, r.address_state].filter(Boolean).join(", ") || "—"}
                      {r.phone ? ` · ${r.phone}` : ""} · synced {new Date(r.last_synced_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {query.trim().length >= 2 && results.length === 0 && (
                  <p className="py-4 text-sm text-muted-foreground">No matching active licenses.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <VetLicenseImportDialog
        source={active}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDone={load}
      />
    </div>
  );
}
