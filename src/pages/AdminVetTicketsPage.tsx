import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  listAllTicketsForAdmin, computeTicketCoverage, approveVetTicket,
  rejectVetTicket, getTicketFileSignedUrl, type VetTicket, type CoverageBreakdown,
} from "@/lib/vet-tickets-api";
import { Loader2, FileText, ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";
import { TicketMessagesDialog } from "@/components/vet-tickets/TicketMessagesDialog";

const STATUS_VARIANT: Record<string, string> = {
  submitted: "secondary", under_review: "secondary",
  approved: "default", funded: "default", card_issued: "default", settled: "default",
  rejected: "destructive", expired: "destructive", cancelled: "destructive",
};

const fmt = (n: any) => `$${Number(n ?? 0).toFixed(2)}`;

export default function AdminVetTicketsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<VetTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setTickets(await listAllTicketsForAdmin());
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user?.id]);

  if (authLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "admin") {
    return (
      <div className="p-6">
        <Card><CardContent className="py-10 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Admin access required.</p>
        </CardContent></Card>
      </div>
    );
  }

  const pending = tickets.filter((t) => ["submitted","under_review"].includes(t.status));
  const others = tickets.filter((t) => !["submitted","under_review"].includes(t.status));

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Vet ticket queue</h1>
        <p className="text-sm text-muted-foreground">Review submitted vet bills and approve coverage.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pending review ({pending.length})</h2>
        {loading ? <div className="text-muted-foreground animate-pulse">Loading…</div>
         : pending.length === 0 ? <p className="text-muted-foreground text-sm">No tickets waiting.</p>
         : <div className="grid gap-4">{pending.map((t) => <AdminTicketCard key={t.id} ticket={t} onChanged={load} />)}</div>}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">All tickets</h2>
        <div className="grid gap-4">
          {others.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t.clinic_name} — {fmt(t.estimate_amount)}</CardTitle>
                  <Badge variant={STATUS_VARIANT[t.status] as any}>{t.status.replace("_"," ")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner: {t.owner_id.slice(0,8)} · Approved {fmt(t.approved_amount)} · {new Date(t.updated_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent>
                <TicketMessagesDialog ticketId={t.id} viewerRole="admin" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminTicketCard({ ticket, onChanged }: { ticket: VetTicket; onChanged: () => void }) {
  const [breakdown, setBreakdown] = useState<CoverageBreakdown | null>(ticket.coverage_breakdown ?? null);
  const [computing, setComputing] = useState(false);
  const [adminNotes, setAdminNotes] = useState(ticket.admin_notes ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const compute = async () => {
    setComputing(true);
    try {
      const b = await computeTicketCoverage(ticket.id);
      setBreakdown(b);
    } catch (e: any) { toast({ title: "Compute failed", description: e.message, variant: "destructive" }); }
    finally { setComputing(false); }
  };

  const approve = async () => {
    if (!breakdown) { toast({ title: "Compute coverage first", variant: "destructive" }); return; }
    setBusy(true);
    try {
      await approveVetTicket(ticket.id, breakdown, adminNotes);
      toast({ title: "Approved" });
      onChanged();
    } catch (e: any) { toast({ title: "Approve failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    setBusy(true);
    try {
      await rejectVetTicket(ticket.id, reason);
      toast({ title: "Rejected" });
      onChanged();
    } catch (e: any) { toast({ title: "Reject failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const openFile = async (path: string) => {
    try { window.open(await getTicketFileSignedUrl(path), "_blank"); }
    catch (e: any) { toast({ title: "Couldn't open", description: e.message, variant: "destructive" }); }
  };

  // updateField helper
  const setField = (k: keyof CoverageBreakdown, v: number) => {
    if (!breakdown) return;
    setBreakdown({ ...breakdown, [k]: v } as CoverageBreakdown);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{ticket.clinic_name} — {fmt(ticket.estimate_amount)}</CardTitle>
          <Badge variant={STATUS_VARIANT[ticket.status] as any}>{ticket.status.replace("_"," ")}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Owner: {ticket.owner_id.slice(0,8)} · Submitted {new Date(ticket.created_at).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {ticket.notes && <p className="text-sm text-muted-foreground">{ticket.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {ticket.estimate_url && (
            <Button variant="outline" size="sm" onClick={() => openFile(ticket.estimate_url!)}>
              <FileText className="h-4 w-4 mr-1" /> Estimate
            </Button>
          )}
          {ticket.attestation_url && (
            <Button variant="outline" size="sm" onClick={() => openFile(ticket.attestation_url!)}>
              <FileText className="h-4 w-4 mr-1" /> Attestation
            </Button>
          )}
          <TicketMessagesDialog ticketId={ticket.id} viewerRole="admin" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={compute} disabled={computing}>
            {computing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Compute coverage
          </Button>
          {breakdown && (
            <span className="text-xs text-muted-foreground">
              Plan: {breakdown.plan_tier ?? "—"} · Year cap remaining: {breakdown.plan_year_cap_remaining === null ? "∞" : fmt(breakdown.plan_year_cap_remaining)} · DP avail: {fmt(breakdown.dp_available)}
            </span>
          )}
        </div>

        {breakdown && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md border p-3 bg-muted/30">
            {(["dp_use","bnpl_use","reserve_use","member_remainder"] as const).map((k) => (
              <div key={k}>
                <Label className="text-xs capitalize">{k.replace("_"," ")}</Label>
                <Input type="number" step="0.01" value={Number((breakdown as any)[k] ?? 0)}
                       onChange={(e) => setField(k, Number(e.target.value))} />
              </div>
            ))}
          </div>
        )}

        <div>
          <Label className="text-xs">Admin notes</Label>
          <Textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={approve} disabled={busy || !breakdown}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Approve
          </Button>
        </div>

        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs">Rejection reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. attestation missing" />
          <Button variant="destructive" onClick={reject} disabled={busy || !reason.trim()}>Reject</Button>
        </div>
      </CardContent>
    </Card>
  );
}
