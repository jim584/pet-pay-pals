import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Clock } from "lucide-react";

interface StateRow {
  code: string;
  name: string;
  board: string;
  lookup_url: string;
  technique: "adapter" | "manual";
  supported: boolean;
}

export default function AdminVerificationCoveragePage() {
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-vet-license`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        const body = await res.json();
        setStates(body.states ?? []);
        setSupported(body.supported ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">License Verification Coverage</h1>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${supported.length} of ${states.length} states have automated adapters. Others require admin manual review.`}
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
                  <th className="py-2 pr-4">Lookup</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
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
                    <td className="py-2 pr-4">
                      <a href={s.lookup_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
