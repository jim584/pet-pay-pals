import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StateRow {
  code: string;
  name: string;
  board: string;
  lookup_url: string;
  technique: "adapter" | "manual";
  supported: boolean;
}

interface Attempt {
  source: string | null;
  status: string;
  attempted_at: string;
  http_status: number | null;
  error: string | null;
}

interface FlagRow {
  state_code: string;
  enabled: boolean;
  disabled_reason: string | null;
}

const FAIL_ALERT_THRESHOLD = 3;

export default function AdminVerificationCoveragePage() {
  const { toast } = useToast();
  const [states, setStates] = useState<StateRow[]>([]);
  const [supported, setSupported] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [flags, setFlags] = useState<Record<string, FlagRow>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-vet-license`;
    const [coverageRes, attemptsRes, flagsRes] = await Promise.all([
      fetch(url, {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }).then((r) => r.json()).catch(() => ({ states: [], supported: [] })),
      supabase
        .from("vet_verification_attempts")
        .select("source, status, attempted_at, http_status, error")
        .eq("kind", "license")
        .order("attempted_at", { ascending: false })
        .limit(2000),
      supabase.from("verification_state_flags").select("state_code, enabled, disabled_reason"),
    ]);
    setStates(coverageRes.states ?? []);
    setSupported(coverageRes.supported ?? []);
    setAttempts((attemptsRes.data ?? []) as Attempt[]);
    const flagMap: Record<string, FlagRow> = {};
    for (const f of (flagsRes.data ?? []) as FlagRow[]) flagMap[f.state_code] = f;
    setFlags(flagMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const lastByState = useMemo(() => {
    const map: Record<string, Attempt> = {};
    for (const a of attempts) {
      const code = a.source?.startsWith("state:") ? a.source.slice(6) : null;
      if (!code || map[code]) continue;
      map[code] = a;
    }
    return map;
  }, [attempts]);

  const lastSuccessByState = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of attempts) {
      if (a.status !== "match") continue;
      const code = a.source?.startsWith("state:") ? a.source.slice(6) : null;
      if (!code || map[code]) continue;
      map[code] = a.attempted_at;
    }
    return map;
  }, [attempts]);

  /** All attempts grouped by state, newest first, capped at 20 for drill-down. */
  const attemptsByState = useMemo(() => {
    const buckets: Record<string, Attempt[]> = {};
    for (const a of attempts) {
      const code = a.source?.startsWith("state:") ? a.source.slice(6) : null;
      if (!code) continue;
      (buckets[code] ??= []).push(a);
    }
    for (const k of Object.keys(buckets)) buckets[k] = buckets[k].slice(0, 20);
    return buckets;
  }, [attempts]);

  /** Consecutive non-match / non-no_match failures per state, newest-first. */
  const consecutiveFailuresByState = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [code, list] of Object.entries(attemptsByState)) {
      let n = 0;
      for (const a of list) {
        if (a.status === "match" || a.status === "no_match" || a.status === "expired" || a.status === "inactive") break;
        n++;
      }
      out[code] = n;
    }
    return out;
  }, [attemptsByState]);

  const alertStates = useMemo(
    () => Object.entries(consecutiveFailuresByState)
      .filter(([, n]) => n >= FAIL_ALERT_THRESHOLD)
      .sort((a, b) => b[1] - a[1]),
    [consecutiveFailuresByState],
  );

  async function toggleFlag(code: string, next: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("verification_state_flags").upsert({
      state_code: code,
      enabled: next,
      disabled_reason: next ? null : "Disabled by admin from coverage page",
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Could not update flag", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${code} adapter ${next ? "enabled" : "disabled"}` });
      await load();
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">License Verification Coverage</h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${supported.length} of ${states.length} states have automated adapters. Others require admin manual review.`}
        </p>
      </div>

      {alertStates.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              States with ≥{FAIL_ALERT_THRESHOLD} consecutive source failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {alertStates.map(([code, n]) => (
                <li key={code} className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{code}</span>
                  <span className="text-muted-foreground">{n} consecutive `source_unavailable` results</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Affected vets remain in `pending_review` — never `unverified` — until the source recovers or an admin overrides.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>State Boards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2 w-6"></th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Board</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Enabled</th>
                  <th className="py-2 pr-4">Last attempt</th>
                  <th className="py-2 pr-4">Last success</th>
                  <th className="py-2 pr-4">Lookup</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => {
                  const last = lastByState[s.code];
                  const success = lastSuccessByState[s.code];
                  const flag = flags[s.code];
                  const enabled = flag ? flag.enabled : true;
                  const rows = attemptsByState[s.code] ?? [];
                  const isOpen = !!expanded[s.code];
                  return (
                    <Fragment key={s.code}>
                      <tr className="border-b hover:bg-muted/40">
                        <td className="py-2 pr-2">
                          {rows.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setExpanded((e) => ({ ...e, [s.code]: !e[s.code] }))}
                              aria-label={isOpen ? `Collapse ${s.code} attempts` : `Expand ${s.code} attempts`}
                            >
                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </Button>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-mono">{s.code} — {s.name}</td>
                        <td className="py-2 pr-4">{s.board}</td>
                        <td className="py-2 pr-4">
                          {s.supported ? (
                            <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Automated</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Manual review</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {s.supported ? (
                            <Switch checked={enabled} onCheckedChange={(v) => toggleFlag(s.code, v)} />
                          ) : (
                            <span className="text-xs text-muted-foreground">n/a</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {last ? (
                            <div className="flex items-start gap-1">
                              {last.status !== "match" && <AlertCircle className="h-3 w-3 mt-0.5 text-amber-600" />}
                              <div>
                                <div className="font-mono">{last.status}{last.http_status ? ` · ${last.http_status}` : ""}</div>
                                <div className="text-muted-foreground">{new Date(last.attempted_at).toLocaleString()}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {success ? new Date(success).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <a href={s.lookup_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td colSpan={8} className="p-4">
                            <div className="text-xs font-semibold mb-2">
                              Last {rows.length} attempts for {s.code}
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                  <th className="py-1 pr-3">Timestamp</th>
                                  <th className="py-1 pr-3">Source</th>
                                  <th className="py-1 pr-3">Result</th>
                                  <th className="py-1 pr-3">HTTP</th>
                                  <th className="py-1 pr-3">Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r, i) => (
                                  <tr key={i} className="border-b border-muted/40">
                                    <td className="py-1 pr-3 whitespace-nowrap">{new Date(r.attempted_at).toLocaleString()}</td>
                                    <td className="py-1 pr-3 font-mono">{r.source}</td>
                                    <td className="py-1 pr-3 font-mono">{r.status}</td>
                                    <td className="py-1 pr-3">{r.http_status ?? "—"}</td>
                                    <td className="py-1 pr-3 text-muted-foreground">{r.error ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
