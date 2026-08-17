import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  uploadCampaignInvoice, submitCampaignInvoice, campaignEffectiveStatus,
  type HelpNowCampaign,
} from "@/lib/help-now-campaigns-api";
import { CampaignExpiryBadge } from "./CampaignExpiryBadge";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

/**
 * Member-facing invoice hand-off for an estimate-backed campaign. Uploading pauses
 * the 60-day clock; an admin then accepts (campaign becomes invoice-backed) or
 * rejects (clock resumes without counting the review days).
 */
export function CampaignInvoicePanel({
  campaign,
  onChange,
}: {
  campaign: HelpNowCampaign;
  onChange: (c: HelpNowCampaign) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const status = campaignEffectiveStatus(campaign);
  const accepted = campaign.document_basis === "invoice";
  const underReview = campaign.invoice_status === "submitted";
  const expired = status === "expired";

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = await uploadCampaignInvoice(user.id, file);
      const updated = await submitCampaignInvoice(campaign.id, path);
      onChange(updated);
      toast({
        title: "Invoice submitted",
        description: "Your 60-day clock is paused while we review it.",
      });
    } catch (e: any) {
      toast({ title: "Couldn't submit invoice", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Actual veterinary invoice</Label>
        <CampaignExpiryBadge campaign={campaign} />
      </div>

      {accepted ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Your invoice has been accepted. The 60-day deadline no longer applies, and this campaign
            can keep raising up to the verified veterinary amount
            {campaign.verified_amount ? ` of ${money(campaign.verified_amount)}` : ""} — less anything
            Direct Pay, a payment plan or the Reserve already covered.
          </p>
          <p className="text-xs text-muted-foreground">
            Funds are not released just because an invoice was accepted. Money is disbursed only when
            the vet is paid through Help a Pet, or with the invoice plus proof the bill was paid.
          </p>
        </div>
      ) : underReview ? (
        <p className="text-xs text-muted-foreground">
          We're reviewing your invoice. The days spent in review won't count against your 60-day period.
        </p>
      ) : expired ? (
        <p className="text-xs text-muted-foreground">
          The 60-day estimate period ended before an invoice was accepted, so donations are closed and
          funds are not released. Direct Pay and payment plans are unaffected.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Once treatment is complete, upload the actual invoice. You don't have to reach your goal first.
          </p>
          {campaign.invoice_status === "rejected" && campaign.invoice_rejection_reason && (
            <p className="text-xs text-destructive">
              Previous invoice was rejected: {campaign.invoice_rejection_reason}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
            Upload actual invoice
          </Button>
        </>
      )}
    </div>
  );
}
