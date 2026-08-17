import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import {
  listCampaignsAwaitingInvoiceReview, listOverRaisedCampaigns, reviewCampaignInvoice,
  getCampaignInvoiceSignedUrl, coverageOffsetTotal,
  type PublicCampaign, type ReviewCampaign,
} from "@/lib/help-now-campaigns-api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

export default function AdminCampaignInvoicesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["adminCampaignInvoices"],
    queryFn: listCampaignsAwaitingInvoiceReview,
  });
  const { data: overRaised } = useQuery({
    queryKey: ["adminCampaignsOverRaised"],
    queryFn: listOverRaisedCampaigns,
  });

  const [accepting, setAccepting] = useState<ReviewCampaign | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState("");
  const [rejecting, setRejecting] = useState<PublicCampaign | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["adminCampaignInvoices"] });
    qc.invalidateQueries({ queryKey: ["adminCampaignsOverRaised"] });
  };

  const openInvoice = async (path: string) => {
    try {
      const url = path.startsWith("http") ? path : await getCampaignInvoiceSignedUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: "Couldn't open invoice", description: e.message, variant: "destructive" });
    }
  };

  // Preview of what the campaign will be allowed to raise once accepted.
  const offsets = accepting ? coverageOffsetTotal(accepting) : 0;
  const parsedAmount = Number(verifiedAmount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const previewGoal = amountValid ? Math.max(0, Math.round((parsedAmount - offsets) * 100) / 100) : 0;
  const alreadyRaised = Number(accepting?.raised_amount ?? 0);
  const wouldOverRaise = amountValid && alreadyRaised > previewGoal;

  const accept = async () => {
    if (!accepting || !amountValid) return;
    setBusy(true);
    try {
      await reviewCampaignInvoice(accepting.id, "accept", { verifiedAmount: parsedAmount });
      toast({
        title: "Invoice accepted",
        description: "The 60-day deadline is removed and the campaign now runs on invoice rules.",
      });
      setAccepting(null);
      setVerifiedAmount("");
      refresh();
    } catch (e: any) {
      toast({ title: "Couldn't accept", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await reviewCampaignInvoice(rejecting.id, "reject", { reason: reason.trim() });
      toast({ title: "Invoice rejected", description: "The 60-day clock has resumed." });
      setRejecting(null);
      setReason("");
      refresh();
    } catch (e: any) {
      toast({ title: "Couldn't reject", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Invoices awaiting review</h1>
        <p className="text-sm text-muted-foreground">
          Accepting an invoice removes the 60-day estimate deadline and caps the campaign at the
          verified veterinary amount. It does not release any funds to the member.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !data?.length ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nothing to review right now.</CardContent></Card>
      ) : (
        data.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{c.title ?? `Help ${c.pet?.name ?? "this pet"}`}</span>
                <Badge variant="secondary">
                  Submitted {c.invoice_submitted_at ? new Date(c.invoice_submitted_at).toLocaleDateString() : "—"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Current goal {fmt(c.goal_amount)} · Raised {fmt(c.raised_amount)} · Already covered
                elsewhere {fmt(coverageOffsetTotal(c))}
              </p>
              <div className="flex flex-wrap gap-2">
                {c.invoice_url && (
                  <Button size="sm" variant="outline" onClick={() => openInvoice(c.invoice_url!)}>
                    <FileText className="h-4 w-4 mr-1" /> View invoice
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => { setAccepting(c); setVerifiedAmount(""); }}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { setRejecting(c); setReason(""); }}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {!!overRaised?.length && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Over-raised campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              These campaigns raised more than the accepted invoice supports. They are closed to new
              funding; the surplus needs a decision.
            </p>
            {overRaised.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span>{c.title ?? `Help ${c.pet?.name ?? "this pet"}`}</span>
                <span className="text-muted-foreground">
                  Raised {fmt(c.raised_amount)} · Verified {fmt(Number(c.verified_amount ?? 0))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Accept: verified amount entry */}
      <Dialog open={!!accepting} onOpenChange={(o) => !o && setAccepting(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accept this invoice</DialogTitle>
            <DialogDescription>
              Enter the total from the invoice document. The campaign will be allowed to raise that
              amount minus what Direct Pay, BNPL and the Reserve already covered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="verified-amount">Verified invoice total (USD)</Label>
              <Input
                id="verified-amount"
                type="number"
                min="0"
                step="0.01"
                value={verifiedAmount}
                onChange={(e) => setVerifiedAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already covered (DP + BNPL + Reserve)</span>
                <span>{fmt(offsets)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>New campaign ceiling</span>
                <span>{amountValid ? fmt(previewGoal) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already raised</span>
                <span>{fmt(alreadyRaised)}</span>
              </div>
            </div>
            {wouldOverRaise && (
              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                This campaign has already raised more than the invoice supports. Accepting will close
                it to new funding and flag the surplus for follow-up.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccepting(null)}>Cancel</Button>
            <Button disabled={!amountValid || busy} onClick={accept}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Accept invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject this invoice</DialogTitle>
            <DialogDescription>
              The member will see your reason and the 60-day clock resumes where it stopped — the
              review days are not counted against them.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what's wrong with the document."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim() || busy} onClick={reject}>
              Reject invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
