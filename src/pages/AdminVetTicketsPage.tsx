import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Textarea no longer needed
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  listAllTicketsForAdmin, computeTicketCoverage, approveVetTicket,
  rejectVetTicket, requestTicketInfo, getTicketFileSignedUrl, type VetTicket,
} from "@/lib/vet-tickets-api";
import { Textarea } from "@/components/ui/textarea";


import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, ShieldAlert, CalendarIcon, X, Filter, MessageSquareWarning } from "lucide-react";
import { Navigate } from "react-router-dom";
import { TicketMessagesDialog } from "@/components/vet-tickets/TicketMessagesDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  "submitted", "under_review", "needs_info", "approved", "funded",
  "card_issued", "settled", "rejected", "expired", "cancelled",
] as const;

const STATUS_VARIANT: Record<string, string> = {
  submitted: "secondary", under_review: "secondary", needs_info: "outline",
  approved: "default", funded: "default", card_issued: "default", settled: "default",
  rejected: "destructive", expired: "destructive", cancelled: "destructive",
};

const fmt = (n: any) => `$${Number(n ?? 0).toFixed(2)}`;

type Clinic = { id: string; clinic_name: string; location: string | null; user_id: string | null };

export default function AdminVetTicketsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<VetTicket[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [status, setStatus] = useState<string>("all");
  const [clinicId, setClinicId] = useState<string>("all");
  const [vetUserId, setVetUserId] = useState<string>("all");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [query, setQuery] = useState("");

  // bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [t, c] = await Promise.all([
      listAllTicketsForAdmin(),
      supabase.from("vet_profiles")
        .select("id, clinic_name, location, user_id")
        .order("clinic_name"),
    ]);
    setTickets(t);
    setClinics((c.data ?? []) as Clinic[]);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user?.id]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (clinicId !== "all" && t.vet_profile_id !== clinicId) return false;
      if (vetUserId !== "all") {
        const c = clinics.find((x) => x.id === t.vet_profile_id);
        if (!c || c.user_id !== vetUserId) return false;
      }
      const created = new Date(t.created_at);
      if (from && created < from) return false;
      if (to) {
        const end = new Date(to); end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${t.clinic_name} ${t.notes ?? ""} ${t.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, clinics, status, clinicId, vetUserId, from, to, query]);

  const vetUsers = useMemo(() => {
    const m = new Map<string, string>();
    clinics.forEach((c) => { if (c.user_id) m.set(c.user_id, c.clinic_name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [clinics]);

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

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const clearFilters = () => {
    setStatus("all"); setClinicId("all"); setVetUserId("all");
    setFrom(undefined); setTo(undefined); setQuery("");
  };

  const selectedTickets = filtered.filter((t) => selected.has(t.id));

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Vet ticket queue</h1>
        <p className="text-sm text-muted-foreground">
          Tickets meeting every eligibility rule are approved automatically. Anything flagged for review appears here for an approve or reject decision.
        </p>
      </div>


      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Clinic</Label>
            <Select value={clinicId} onValueChange={setClinicId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clinics</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.clinic_name}{c.location ? ` — ${c.location}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vet (user)</Label>
            <Select value={vetUserId} onValueChange={setVetUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vets</SelectItem>
                {vetUsers.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !from && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {from ? format(from, "PP") : "Any"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={from} onSelect={setFrom} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !to && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {to ? format(to, "PP") : "Any"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={to} onSelect={setTo} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">Search</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="clinic, notes, id…" />
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-3 border rounded-md p-3 bg-muted/30">
        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
        <span className="text-sm">
          {selected.size > 0
            ? <><strong>{selected.size}</strong> selected</>
            : `${filtered.length} ticket${filtered.length === 1 ? "" : "s"} shown`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <BulkReassignButton tickets={selectedTickets} clinics={clinics} onDone={load} />
        </div>

      </div>

      {/* Tickets list */}
      <section>
        {loading ? (
          <div className="text-muted-foreground animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
            No tickets match these filters.
          </CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((t) => (
              <AdminTicketCard
                key={t.id}
                ticket={t}
                clinicMap={clinics}
                checked={selected.has(t.id)}
                onToggle={() => toggle(t.id)}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


function BulkReassignButton({
  tickets, clinics, onDone,
}: { tickets: VetTicket[]; clinics: Clinic[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (tickets.length === 0) return;
    setBusy(true);
    try {
      const ids = tickets.map((t) => t.id);
      let payload: { vet_profile_id: string | null; clinic_name?: string };
      if (target === "__unassign__") {
        payload = { vet_profile_id: null };
      } else {
        const c = clinics.find((x) => x.id === target);
        if (!c) throw new Error("Pick a clinic");
        payload = { vet_profile_id: c.id, clinic_name: c.clinic_name };
      }
      const { error } = await supabase
        .from("vet_tickets")
        .update(payload as any)
        .in("id", ids);
      if (error) throw error;
      toast({ title: "Reassigned", description: `${ids.length} ticket(s) updated.` });
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast({ title: "Reassign failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={tickets.length === 0}>
          Reassign clinic ({tickets.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Reassign {tickets.length} ticket(s)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Target clinic</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="Pick a clinic" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassign__">Unassign (admin-only)</SelectItem>
              {clinics.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.clinic_name}{c.location ? ` — ${c.location}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The selected clinic will see these tickets in their incoming queue.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy || !target}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminTicketCard({
  ticket, clinicMap, checked, onToggle, onChanged,
}: {
  ticket: VetTicket;
  clinicMap: Clinic[];
  checked: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const breakdown = ticket.coverage_breakdown ?? null;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const pending = ["submitted", "under_review", "awaiting_secondary_review", "needs_info"].includes(ticket.status);
  const canReject = ["submitted", "under_review", "awaiting_secondary_review", "needs_info", "approved"].includes(ticket.status);
  const assignedClinic = clinicMap.find((c) => c.id === ticket.vet_profile_id);
  const blockers = (ticket as any).auto_approval_blockers as string[] | null;

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

  const sendInfoRequest = async () => {
    if (infoMessage.trim().length < 5) {
      toast({ title: "Please describe what is missing", variant: "destructive" });
      return;
    }
    setInfoBusy(true);
    try {
      await requestTicketInfo(ticket.id, infoMessage.trim());
      toast({ title: "Info requested", description: "The submitter has been asked to respond." });
      setInfoMessage("");
      setInfoOpen(false);
      onChanged();
    } catch (e: any) { toast({ title: "Request failed", description: e.message, variant: "destructive" }); }
    finally { setInfoBusy(false); }
  };

  const approve = async () => {
    setApproving(true);
    try {
      const bd = await computeTicketCoverage(ticket.id, false);
      await approveVetTicket(ticket.id, bd, "approved after admin review");
      toast({ title: "Approved" });
      onChanged();
    } catch (e: any) { toast({ title: "Approve failed", description: e.message, variant: "destructive" }); }
    finally { setApproving(false); }
  };


  const openFile = async (path: string) => {
    try { window.open(await getTicketFileSignedUrl(path), "_blank"); }
    catch (e: any) { toast({ title: "Couldn't open", description: e.message, variant: "destructive" }); }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
            <div>
              <CardTitle className="text-base">{ticket.clinic_name} — {fmt(ticket.estimate_amount)}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Owner: {ticket.owner_id.slice(0, 8)} · Submitted {new Date(ticket.created_at).toLocaleString()}
                {assignedClinic ? ` · Assigned: ${assignedClinic.clinic_name}` : " · Unassigned"}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[ticket.status] as any}>{ticket.status.replace("_", " ")}</Badge>
        </div>
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

        <p className="text-xs text-muted-foreground">
          {ticket.status === "rejected"
            ? `Rejected · Updated ${new Date(ticket.updated_at).toLocaleString()}`
            : pending
              ? `Awaiting decision · Updated ${new Date(ticket.updated_at).toLocaleString()}`
              : `Approved ${fmt(ticket.approved_amount ?? ticket.estimate_amount)} · Updated ${new Date(ticket.updated_at).toLocaleString()}`}
        </p>

        {pending && blockers && blockers.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive mb-1">Why this needs review</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {blockers.map((b) => <li key={b}>{b.replace(/_/g, " ")}</li>)}
            </ul>
          </div>
        )}

        {ticket.info_request_message && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
            <p className="text-xs font-semibold">Information requested</p>
            <p className="text-xs text-muted-foreground">{ticket.info_request_message}</p>
            {ticket.info_requested_at && (
              <p className="text-[11px] text-muted-foreground">
                Asked {new Date(ticket.info_requested_at).toLocaleString()}
              </p>
            )}
            {ticket.info_response_message && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-semibold">Submitter response</p>
                <p className="text-xs text-muted-foreground">{ticket.info_response_message}</p>
                {ticket.info_responded_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Replied {new Date(ticket.info_responded_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {breakdown && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md border p-3 bg-muted/30 text-xs">
            {(["dp_use", "bnpl_use", "reserve_use", "member_remainder"] as const).map((k) => (
              <div key={k}>
                <div className="text-muted-foreground capitalize">
                  {k === "member_remainder" ? "Member remainder" : k.replace("_", " ")}
                </div>
                <div className="font-medium">{fmt((breakdown as any)[k] ?? 0)}</div>
              </div>
            ))}
          </div>
        )}

        {pending && (
          <div className="border-t pt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={approve} disabled={approving}>
              {approving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Approve ticket
            </Button>
            <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <MessageSquareWarning className="h-4 w-4 mr-1" /> Request info
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Request more information</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label className="text-xs">What is missing?</Label>
                  <Textarea
                    value={infoMessage}
                    onChange={(e) => setInfoMessage(e.target.value)}
                    placeholder="e.g. The estimate is illegible — please upload a clearer copy showing the clinic letterhead."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    The ticket moves to "needs info" until the submitter responds.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={sendInfoRequest} disabled={infoBusy || infoMessage.trim().length < 5}>
                    {infoBusy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Send request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}


        {canReject && (

          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">Rejection reason (fraud / abuse only)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. suspected fraud" />
            <Button variant="destructive" size="sm" onClick={reject} disabled={busy || !reason.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

