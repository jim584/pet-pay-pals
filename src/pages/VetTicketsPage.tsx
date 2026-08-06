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
  getTicketFileSignedUrl, computeTicketCoverage, respondTicketInfo, type VetTicket, type CoverageBreakdown,
} from "@/lib/vet-tickets-api";
import { fetchVetProfile } from "@/lib/vet-api";
import { Loader2, Plus, FileText, ExternalLink, ShieldCheck, Info, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TicketMessagesDialog } from "@/components/vet-tickets/TicketMessagesDialog";
import { openCheckoutUrl } from "@/lib/open-checkout";
import { ReconsiderationButton } from "@/components/vet/ReconsiderationButton";

const STATUS_VARIANT: Record<string, string> = {
  submitted: "secondary", under_review: "secondary", needs_info: "outline",
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
  const [clinics, setClinics] = useState<{ id: string; clinic_name: string; location: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [t, p, c] = await Promise.all([
      listMyTickets(user.id),
      supabase.from("pets").select("id, name").eq("owner_id", user.id),
      supabase.from("vet_profiles").select("id, clinic_name, location").eq("is_approved", true).order("clinic_name"),
    ]);
    setTickets(t);
    setPets((p.data ?? []) as any);
    setClinics((c.data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vet Tickets</h1>
          <p className="text-sm text-muted-foreground">Submit a vet bill for coverage from your plan. Use any clinic you like — Fear Free certified, your local vet, or a national chain like Banfield.</p>
          <p className="text-xs text-muted-foreground mt-1">Every request is checked against our eligibility rules. Requests that meet all of them are approved straight away; anything else is reviewed by our team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New ticket</Button>
          </DialogTrigger>
          <NewTicketDialog pets={pets} clinics={clinics} onCreated={() => { setOpen(false); load(); }} />
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
                  <TicketMessagesDialog ticketId={t.id} viewerRole="vet" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTicketDialog({ pets, clinics, onCreated }: {
  pets: { id: string; name: string }[];
  clinics: { id: string; clinic_name: string; location: string | null }[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [petId, setPetId] = useState<string>("");
  const [clinicMode, setClinicMode] = useState<"registered" | "other">("registered");
  const [clinicId, setClinicId] = useState<string>("");
  const [clinicNameOther, setClinicNameOther] = useState("");
  const [estimateAmount, setEstimateAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [attestationFile, setAttestationFile] = useState<File | null>(null);
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedClinic = clinics.find((c) => c.id === clinicId);
  const effectiveClinicName = clinicMode === "registered" ? selectedClinic?.clinic_name ?? "" : clinicNameOther.trim();
  const effectiveVetProfileId = clinicMode === "registered" ? clinicId || null : null;

  const submit = async () => {
    if (!user) return;
    if (!petId || !effectiveClinicName || !estimateAmount) {
      toast({ title: "Missing info", description: "Pet, clinic, and amount are required.", variant: "destructive" });
      return;
    }
    if (!estimateFile) {
      toast({ title: "Estimate required", description: "Attach the itemised estimate or invoice from your clinic.", variant: "destructive" });
      return;
    }
    if (!attestationConfirmed) {
      toast({ title: "Attestation required", description: "Please confirm the declaration before submitting.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let attestationUrl: string | null = null;
      const estimateUrl = await uploadTicketFile(user.id, estimateFile, "estimate");
      if (attestationFile) attestationUrl = await uploadTicketFile(user.id, attestationFile, "attestation");
      const res = await submitVetTicket({
        pet_id: petId,
        clinic_name: effectiveClinicName,
        vet_profile_id: effectiveVetProfileId,
        estimate_amount: Number(estimateAmount),
        estimate_url: estimateUrl, attestation_url: attestationUrl,
        notes: notes || null,
        attestation_confirmed: true,
      });
      toast({
        title: res.auto_approved ? "Ticket approved" : "Ticket submitted for review",
        description: res.auto_approved
          ? "Your request met every eligibility rule and was approved. Check your ticket for next steps."
          : "Your request has been received and is being reviewed by our team.",
      });
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
          <Label>Clinic</Label>
          <Select
            value={clinicMode === "other" ? "__other__" : clinicId}
            onValueChange={(v) => {
              if (v === "__other__") { setClinicMode("other"); setClinicId(""); }
              else { setClinicMode("registered"); setClinicId(v); }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={clinics.length ? "Select a registered clinic" : "No registered clinics yet"} />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.clinic_name}{c.location ? ` — ${c.location}` : ""}
                </SelectItem>
              ))}
              <SelectItem value="__other__">Other / not listed…</SelectItem>
            </SelectContent>
          </Select>
          {clinicMode === "other" && (
            <Input
              className="mt-2"
              value={clinicNameOther}
              onChange={(e) => setClinicNameOther(e.target.value)}
              placeholder="Enter clinic name"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {clinicMode === "registered"
              ? "Selecting a registered clinic shares the ticket with them so they can see it in their dashboard."
              : "This ticket will only be visible to our admin team for review."}
          </p>
        </div>
        <div>
          <Label>Estimate amount (USD)</Label>
          <Input type="number" min="0" step="0.01" value={estimateAmount}
                 onChange={(e) => setEstimateAmount(e.target.value)} placeholder="450.00" />
        </div>
        <div>
          <Label>Estimate / invoice (PDF or image) <span className="text-destructive">*</span></Label>
          <Input type="file" accept=".pdf,image/*" onChange={(e) => setEstimateFile(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground mt-1">Required. Attach the itemised document from your clinic.</p>
        </div>
        <div>
          <Label>Veterinarian attestation form (optional upload)</Label>
          <Input type="file" accept=".pdf,image/*" onChange={(e) => setAttestationFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={attestationConfirmed}
            onChange={(e) => setAttestationConfirmed(e.target.checked)}
          />
          <span className="text-xs text-muted-foreground">
            I confirm that the attached estimate is genuine, was issued by the clinic named above for
            the pet selected, relates to treatment that has not already been claimed, and that the
            information I have provided is true and complete.
          </span>
        </label>

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
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [useReserve, setUseReserve] = useState(false);
  const [previewBreakdown, setPreviewBreakdown] = useState<CoverageBreakdown | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [infoReply, setInfoReply] = useState("");
  const [infoFile, setInfoFile] = useState<File | null>(null);
  const [sendingInfo, setSendingInfo] = useState(false);

  const sendInfoResponse = async () => {
    if (!infoReply.trim() && !infoFile) {
      toast({ title: "Add a reply or a document", variant: "destructive" });
      return;
    }
    setSendingInfo(true);
    try {
      let path: string | null = null;
      if (infoFile && user) path = await uploadTicketFile(user.id, infoFile, "estimate");
      await respondTicketInfo(ticket.id, infoReply.trim(), path);
      toast({ title: "Response sent", description: "Your ticket is back with the review team." });
      setInfoReply("");
      setInfoFile(null);
      onChanged();
    } catch (e: any) {
      toast({ title: "Couldn't send response", description: e.message, variant: "destructive" });
    } finally {
      setSendingInfo(false);
    }
  };


  // Auto-preview reserve eligibility once for submitted/under_review tickets
  useEffect(() => {
    if (["submitted", "under_review"].includes(ticket.status) && !previewBreakdown) {
      computeTicketCoverage(ticket.id, false).then(setPreviewBreakdown).catch(() => {});
    }
  }, [ticket.id, ticket.status]);

  const togglePreviewReserve = async (next: boolean) => {
    setUseReserve(next);
    setPreviewing(true);
    try {
      const b = await computeTicketCoverage(ticket.id, next);
      setPreviewBreakdown(b);
    } catch (e: any) {
      toast({ title: "Couldn't recompute coverage", description: e.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const payRemainder = async () => {
    setPaying(true);
    try {
      const url = await startMemberRemainderCheckout(ticket.id);
      openCheckoutUrl(url);
    } catch (e: any) {
      toast({ title: "Couldn't start checkout", description: e.message, variant: "destructive" });
    } finally {
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

  const b = ticket.coverage_breakdown ?? previewBreakdown;
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
          <TicketMessagesDialog ticketId={ticket.id} viewerRole="owner" />
        </div>

        {b && (
          <div className="rounded-md border p-3 bg-muted/30 grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Direct Pay</span><span>{fmt(b.dp_use)}</span>
            <span className="text-muted-foreground">BNPL</span><span>{fmt(b.bnpl_use)}</span>
            <span className="text-muted-foreground">Reserve pool</span><span>{fmt(b.reserve_use)}</span>
            <span className="text-muted-foreground">Your portion (paid to Help A Pet)</span><span className="font-medium">{fmt(b.member_remainder)}</span>
          </div>
        )}

        {/* Reserve pool opt-in toggle (pending/under-review only) */}
        {["submitted", "under_review"].includes(ticket.status) && b && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Request the Community Reserve Pool as a fallback</p>
                  <p className="text-xs text-muted-foreground">
                    The Reserve is a shared community pool — not a personal balance. It's discretionary
                    and only used <strong>after</strong> Direct Pay and BNPL can't cover the full amount,
                    while pool funds are available.
                  </p>
                </div>
              </div>
              <Switch
                checked={useReserve}
                disabled={previewing || !b.reserve_eligible || Number(b.reserve_available ?? 0) <= 0}
                onCheckedChange={togglePreviewReserve}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" title="Shared community funds. May change as other members use the pool.">
                Pool availability: {fmt(b.reserve_available ?? 0)}
              </Badge>
              {b.reserve_eligible
                ? <Badge variant="secondary">Eligible</Badge>
                : <Badge variant="outline" className="text-muted-foreground">Not yet eligible</Badge>}
              {useReserve && Number(b.reserve_use) > 0 && (
                <Badge>Will draw {fmt(b.reserve_use)}</Badge>
              )}
            </div>
            {b.reserve_blocked_reason && (
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5" /> {b.reserve_blocked_reason}
              </p>
            )}
            {!b.reserve_eligible && !b.reserve_blocked_reason && (
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5" />
                Reserve pool access unlocks after 12 consecutive months of paid membership.
              </p>
            )}
          </div>
        )}


        {ticket.status === "rejected" && ticket.rejection_reason && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Reason: {ticket.rejection_reason}</p>
            <ReconsiderationButton ticketId={ticket.id} />
          </div>
        )}

        {ticket.status === "awaiting_secondary_review" && (
          <div className="space-y-2">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This ticket needs a secondary admin review because reserve-pool funds
              were requested after all BNPL providers declined.
            </p>
            <ReconsiderationButton ticketId={ticket.id} label="Add context for reviewer" />
          </div>
        )}

        {ticket.status === "approved" && Number(b?.member_remainder ?? 0) > 0 && (
          <div className="space-y-1">
            <Button onClick={payRemainder} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Pay your portion to Help A Pet ({fmt(b?.member_remainder)})
            </Button>
            <p className="text-xs text-muted-foreground">
              We charge your card on file. Once paid, Help A Pet issues a Visa card that the clinic runs as a normal card transaction.
            </p>
          </div>
        )}

        {ticket.status === "funded" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Funded — Help A Pet is issuing the clinic's Visa card now.
          </p>
        )}

        {(ticket.status === "card_issued" || ticket.status === "settled") && (
          <div className="space-y-1">
            <Button asChild size="sm">
              <a href={`/vet-tickets/${ticket.id}/card`}>
                View vet card
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Share the card details with your clinic — they run it like any other Visa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
