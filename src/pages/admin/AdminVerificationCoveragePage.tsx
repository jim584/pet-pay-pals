import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Clock, AlertCircle } from "lucide-react";

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

export default function AdminVerificationCoveragePage() {
  const [states, setStates] = useState<StateRow[]>([]);
  const [supported, setSupported] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-vet-license`;
      const [coverageRes, attemptsRes] = await Promise.all([
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
      ]);
      setStates(coverageRes.states ?? []);
      setSupported(coverageRes.supported ?? []);
      setAttempts((attemptsRes.data ?? []) as Attempt[]);
      setLoading(false);
    })();
  }, []);

  // Roll attempts up by state code (source format: "state:CA").
  const lastByState = useMemo(() => {
    const map: Record<string, Attempt> = {};
    for (const a of attempts) {
      const code = a.source?.startsWith("state:") ? a.source.slice(6) : null;
      if (!code) continue;
      if (!map[code]) map[code] = a;
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

      <Card>
        <CardHeader>
          <CardTitle>State Boards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Board</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last attempt</th>
                  <th className="py-2 pr-4">Last success</th>
                  <th className="py-2 pr-4">Lookup</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => {
                  const last = lastByState[s.code];
                  const success = lastSuccessByState[s.code];
                  return (
                    <tr key={s.code} className="border-b hover:bg-muted/40">
                      <td className="py-2 pr-4 font-mono">{s.code} — {s.name}</td>
                      <td className="py-2 pr-4">{s.board}</td>
                      <td className="py-2 pr-4">
                        {s.supported ? (
                          <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Automated</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Manual review</Badge>
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
