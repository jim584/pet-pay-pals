import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  ticket_id: string;
  requester_id: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  ticket?: { clinic_name: string; estimate_amount: number; status: string };
}

export default function AdminReconsiderationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ticket_reconsideration_requests")
      .select("*, ticket:vet_tickets(clinic_name, estimate_amount, status)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, status: "approved" | "denied" | "needs_info") => {
    setBusy(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("ticket_reconsideration_requests")
      .update({
        status,
        admin_notes: notes[id] ?? null,
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    if (status === "approved") {
      // Re-open the ticket so admin can run through normal approve flow
      const row = rows.find((r) => r.id === id);
      if (row) {
        await supabase.from("vet_tickets")
          .update({ status: "submitted" }).eq("id", row.ticket_id);
      }
    }
    toast.success(`Request marked ${status}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reconsideration Requests</h1>
        <p className="text-muted-foreground">Members requesting re-review of denied tickets or reserve access.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No reconsideration requests.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base">
                    {r.ticket?.clinic_name ?? "Ticket"} · ${Number(r.ticket?.estimate_amount ?? 0).toFixed(2)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge>
                    <Badge variant="outline">ticket: {r.ticket?.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Member's reason</p>
                  <p className="text-sm whitespace-pre-wrap">{r.reason}</p>
                </div>
                {r.status === "open" && (
                  <>
                    <Textarea
                      placeholder="Admin notes (optional)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy === r.id} onClick={() => resolve(r.id, "approved")}>
                        Approve & re-open ticket
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => resolve(r.id, "needs_info")}>
                        Request more info
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => resolve(r.id, "denied")}>
                        Deny
                      </Button>
                    </div>
                  </>
                )}
                {r.admin_notes && (
                  <p className="text-xs text-muted-foreground"><strong>Admin notes:</strong> {r.admin_notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
