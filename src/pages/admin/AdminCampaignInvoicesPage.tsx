import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { FileText, Loader2 } from "lucide-react";
import {
  listCampaignsAwaitingInvoiceReview, reviewCampaignInvoice, getCampaignInvoiceSignedUrl,
  type PublicCampaign,
} from "@/lib/help-now-campaigns-api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

export default function AdminCampaignInvoicesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["adminCampaignInvoices"],
    queryFn: listCampaignsAwaitingInvoiceReview,
  });
  const [rejecting, setRejecting] = useState<PublicCampaign | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["adminCampaignInvoices"] });

  const openInvoice = async (path: string) => {
    try {
      const url = path.startsWith("http") ? path : await getCampaignInvoiceSignedUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: "Couldn't open invoice", description: e.message, variant: "destructive" });
    }
  };

  const accept = async (c: PublicCampaign) => {
    setBusyId(c.id);
    try {
      await reviewCampaignInvoice(c.id, "accept");
      toast({ title: "Invoice accepted", description: "The campaign is now invoice-backed." });
      refresh();
    } catch (e: any) {
      toast({ title: "Couldn't accept", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await reviewCampaignInvoice(rejecting.id, "reject", reason.trim());
      toast({ title: "Invoice rejected", description: "The 60-day clock has resumed." });
      setRejecting(null);
      setReason("");
      refresh();
    } catch (e: any) {
      toast({ title: "Couldn't reject", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Invoices awaiting review</h1>
        <p className="text-sm text-muted-foreground">
          Help A Pet Now campaigns that submitted an actual invoice. The 60-day estimate clock is
          paused while a campaign sits here.
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
                Goal {fmt(c.goal_amount)} · Raised {fmt(c.raised_amount)}
              </p>
              <div className="flex flex-wrap gap-2">
                {c.invoice_url && (
                  <Button size="sm" variant="outline" onClick={() => openInvoice(c.invoice_url!)}>
                    <FileText className="h-4 w-4 mr-1" /> View invoice
                  </Button>
                )}
                <Button size="sm" disabled={busyId === c.id} onClick={() => accept(c)}>
                  {busyId === c.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busyId === c.id}
                  onClick={() => { setRejecting(c); setReason(""); }}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

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
            <Button variant="destructive" disabled={!reason.trim() || !!busyId} onClick={reject}>
              Reject invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
