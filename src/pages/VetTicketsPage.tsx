import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  listMyTickets, listTicketsForVet, submitVetTicket, uploadTicketFile, startMemberRemainderCheckout,
  getTicketFileSignedUrl, type VetTicket,
} from "@/lib/vet-tickets-api";
import { fetchVetProfile } from "@/lib/vet-api";
import { Loader2, Plus, FileText, ExternalLink } from "lucide-react";

const STATUS_VARIANT: Record<string, string> = {
  submitted: "secondary", under_review: "secondary",
  approved: "default", funded: "default", card_issued: "default", settled: "default",
  rejected: "destructive", expired: "destructive", cancelled: "destructive",
};

function fmt(n: number | null | undefined) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

export default function VetTicketsPage() {
  const { user, role } = useAuth();
  if (role === "vet") return <VetIncomingTickets />;
  return <OwnerVetTicketsView />;
}

function OwnerVetTicketsView() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<VetTicket[]>([]);
  const [pets, setPets] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [t, p] = await Promise.all([
      listMyTickets(user.id),
      supabase.from("pets").select("id, name").eq("owner_id", user.id),
    ]);
    setTickets(t);
    setPets((p.data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vet Tickets</h1>
          <p className="text-sm text-muted-foreground">Submit a vet bill for coverage from your plan.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New ticket</Button>
          </DialogTrigger>
          <NewTicketDialog pets={pets} onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading…</div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No tickets yet. Click <strong>New ticket</strong> to submit your first vet bill.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

type IncomingRow = VetTicket & { pet_name?: string; owner_name?: string };

function VetIncomingTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<IncomingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const profile = await fetchVetProfile(user.id);
        if (!profile) { setTickets([]); return; }
        const tix = await listTicketsForVet(profile.id);
        const petIds = Array.from(new Set(tix.map((t) => t.pet_id).filter(Boolean)));
        const ownerIds = Array.from(new Set(tix.map((t) => t.owner_id).filter(Boolean)));
        const [petsRes, profsRes] = await Promise.all([
          petIds.length
            ? supabase.from("pets").select("id, name").in("id", petIds)
            : Promise.resolve({ data: [] } as any),
          ownerIds.length
            ? supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds)
            : Promise.resolve({ data: [] } as any),
        ]);
        const petMap = new Map((petsRes.data ?? []).map((p: any) => [p.id, p.name]));
        const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.user_id, p.full_name]));
        setTickets(tix.map((t) => ({
          ...t,
          pet_name: petMap.get(t.pet_id) as string | undefined,
          owner_name: profMap.get(t.owner_id) as string | undefined,
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const openFile = async (path: string) => {
    try {
      const url = await getTicketFileSignedUrl(path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: "Couldn't open file", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Incoming Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Tickets submitted by pet owners and assigned to your clinic. Read-only — only pet owners can create tickets.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading…</div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No incoming tickets yet. When a pet owner submits a ticket and selects your clinic, it will appear here.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    {t.pet_name ?? "Pet"} — {fmt(t.estimate_amount)}
                  </CardTitle>
                  <Badge variant={STATUS_VARIANT[t.status] as any}>{t.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner: {t.owner_name ?? "—"} · Submitted {new Date(t.created_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {t.notes && <p className="text-muted-foreground">{t.notes}</p>}
                <div className="flex flex-wrap gap-3">
                  {t.estimate_url && (
                    <Button variant="outline" size="sm" onClick={() => openFile(t.estimate_url!)}>
                      <FileText className="h-4 w-4 mr-1" /> Estimate
                    </Button>
                  )}
                  {t.attestation_url && (
                    <Button variant="outline" size="sm" onClick={() => openFile(t.attestation_url!)}>
                      <FileText className="h-4 w-4 mr-1" /> Attestation
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTicketDialog({ pets, onCreated }: { pets: { id: string; name: string }[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [petId, setPetId] = useState<string>("");
  const [clinicName, setClinicName] = useState("");
  const [estimateAmount, setEstimateAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [attestationFile, setAttestationFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!petId || !clinicName || !estimateAmount) {
      toast({ title: "Missing info", description: "Pet, clinic, and amount are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let estimateUrl: string | null = null;
      let attestationUrl: string | null = null;
      if (estimateFile) estimateUrl = await uploadTicketFile(user.id, estimateFile, "estimate");
      if (attestationFile) attestationUrl = await uploadTicketFile(user.id, attestationFile, "attestation");
      await submitVetTicket({
        pet_id: petId, clinic_name: clinicName,
        estimate_amount: Number(estimateAmount),
        estimate_url: estimateUrl, attestation_url: attestationUrl,
        notes: notes || null,
      });
      toast({ title: "Ticket submitted", description: "An admin will review it shortly." });
      onCreated();
    } catch (e: any) {
      toast({ title: "Couldn't submit", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New vet ticket</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Pet</Label>
          <Select value={petId} onValueChange={setPetId}>
            <SelectTrigger><SelectValue placeholder="Select a pet" /></SelectTrigger>
            <SelectContent>
              {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Clinic name</Label>
          <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. North Hills Vet" />
        </div>
        <div>
          <Label>Estimate amount (USD)</Label>
          <Input type="number" min="0" step="0.01" value={estimateAmount}
                 onChange={(e) => setEstimateAmount(e.target.value)} placeholder="450.00" />
        </div>
        <div>
          <Label>Estimate / invoice (PDF or image)</Label>
          <Input type="file" accept=".pdf,image/*" onChange={(e) => setEstimateFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>Veterinarian attestation form</Label>
          <Input type="file" accept=".pdf,image/*" onChange={(e) => setAttestationFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Submit ticket
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TicketCard({ ticket, onChanged }: { ticket: VetTicket; onChanged: () => void }) {
  const [paying, setPaying] = useState(false);

  const payRemainder = async () => {
    setPaying(true);
    try {
      const url = await startMemberRemainderCheckout(ticket.id);
      window.location.href = url;
    } catch (e: any) {
      toast({ title: "Couldn't start checkout", description: e.message, variant: "destructive" });
      setPaying(false);
    }
  };

  const openFile = async (path: string) => {
    try {
      const url = await getTicketFileSignedUrl(path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: "Couldn't open file", description: e.message, variant: "destructive" });
    }
  };

  const b = ticket.coverage_breakdown;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {ticket.clinic_name} — {fmt(ticket.estimate_amount)}
          </CardTitle>
          <Badge variant={STATUS_VARIANT[ticket.status] as any}>{ticket.status.replace("_"," ")}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Submitted {new Date(ticket.created_at).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {ticket.notes && <p className="text-muted-foreground">{ticket.notes}</p>}

        <div className="flex flex-wrap gap-3">
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
        </div>

        {b && (
          <div className="rounded-md border p-3 bg-muted/30 grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Direct Pay</span><span>{fmt(b.dp_use)}</span>
            <span className="text-muted-foreground">BNPL</span><span>{fmt(b.bnpl_use)}</span>
            <span className="text-muted-foreground">Reserve</span><span>{fmt(b.reserve_use)}</span>
            <span className="text-muted-foreground">Your portion</span><span className="font-medium">{fmt(b.member_remainder)}</span>
          </div>
        )}

        {ticket.status === "rejected" && ticket.rejection_reason && (
          <p className="text-sm text-destructive">Reason: {ticket.rejection_reason}</p>
        )}

        {ticket.status === "approved" && Number(b?.member_remainder ?? 0) > 0 && (
          <Button onClick={payRemainder} disabled={paying}>
            {paying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Pay your portion ({fmt(b?.member_remainder)})
          </Button>
        )}

        {ticket.status === "funded" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Funded — issuing your vet card now…
          </p>
        )}

        {(ticket.status === "card_issued" || ticket.status === "settled") && (
          <Button asChild size="sm">
            <a href={`/vet-tickets/${ticket.id}/card`}>
              View vet card
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
