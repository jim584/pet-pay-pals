import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileUp, Check, Circle, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  uploadCampaignInvoice, submitCampaignInvoice, campaignEffectiveStatus,
  uploadCampaignProof, submitCampaignProof, campaignDisbursementState, campaignProofRequired,
  type HelpNowCampaign,
} from "@/lib/help-now-campaigns-api";
import { CampaignExpiryBadge } from "./CampaignExpiryBadge";
import { DisbursementReadinessBadge } from "./DisbursementReadinessBadge";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

function ChecklistRow({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {done
        ? <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
        : <Circle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />}
      <span className={done ? "" : "text-muted-foreground"}>{children}</span>
    </div>
  );
}

/**
 * Member-facing invoice hand-off for an estimate-backed campaign. Uploading pauses
 * the 60-day clock; an admin then accepts (campaign becomes invoice-backed) or
 * rejects (clock resumes without counting the review days).
 *
 * Once an invoice is accepted, Requirement 12 applies: funds are only eligible for
 * release when Help a Pet pays the vet directly, or when the member also provides
 * verified proof that they paid the bill.
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
  const [proofBusy, setProofBusy] = useState(false);
  const [payingDirect, setPayingDirect] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);

  const status = campaignEffectiveStatus(campaign);
  const accepted = campaign.document_basis === "invoice";
  const underReview = campaign.invoice_status === "submitted";
  const expired = status === "expired";
  const disbursement = campaignDisbursementState(campaign);
  const proofRequired = campaignProofRequired(campaign);
  const proofStatus = campaign.proof_of_payment_status;

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

  const handleProof = async (file: File | undefined) => {
    if (!file || !user) return;
    setProofBusy(true);
    try {
      const path = await uploadCampaignProof(user.id, file);
      const updated = await submitCampaignProof(campaign.id, path);
      onChange(updated);
      toast({
        title: "Proof of payment submitted",
        description: "We'll verify it against your invoice before any funds are released.",
      });
    } catch (e: any) {
      toast({ title: "Couldn't submit proof", description: e.message, variant: "destructive" });
    } finally {
      setProofBusy(false);
      if (proofRef.current) proofRef.current.value = "";
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
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

      {/* Disbursement readiness — Requirement 12 */}
      <div className="rounded-md bg-muted/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Disbursement readiness</Label>
          <DisbursementReadinessBadge campaign={campaign} />
        </div>

        <div className="space-y-1">
          <ChecklistRow done={accepted}>Verified veterinary invoice</ChecklistRow>
          <ChecklistRow done={disbursement.eligible}>
            {campaign.disbursement_path === "direct_vet"
              ? "Veterinarian paid directly through Help a Pet"
              : "Proof that the veterinary bill was paid"}
          </ChecklistRow>
        </div>

        <p className="text-xs text-muted-foreground">{disbursement.detail}</p>

        {accepted && !disbursement.eligible && (
          <>
            <p className="text-xs text-muted-foreground">
              An unpaid invoice on its own does not release funds. Tell us which applies:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={payingDirect ? "default" : "outline"}
                onClick={() => setPayingDirect(true)}
              >
                Help a Pet is paying my vet directly
              </Button>
              <Button
                size="sm"
                variant={!payingDirect ? "default" : "outline"}
                onClick={() => setPayingDirect(false)}
              >
                I already paid my vet
              </Button>
            </div>

            {payingDirect ? (
              <p className="text-xs text-muted-foreground">
                No receipt is needed. Funds move to the clinic through the Help a Pet card or vet
                payment process, and this campaign becomes eligible once that payment settles.
              </p>
            ) : (
              <>
                {proofStatus === "submitted" ? (
                  <p className="text-xs text-muted-foreground">
                    Your proof of payment is under review. Nothing is released until it's verified.
                  </p>
                ) : (
                  <>
                    {proofStatus === "rejected" && campaign.proof_rejection_reason && (
                      <p className="text-xs text-destructive">
                        Proof of payment was rejected: {campaign.proof_rejection_reason}
                      </p>
                    )}
                    {proofStatus === "flagged" && (
                      <p className="text-xs text-destructive">
                        Your invoice and receipt didn't appear to match the same veterinary expense, so
                        this was flagged for manual review
                        {campaign.proof_rejection_reason ? `: ${campaign.proof_rejection_reason}` : "."}
                      </p>
                    )}
                    <input
                      ref={proofRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleProof(e.target.files?.[0])}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={proofBusy || !proofRequired}
                      onClick={() => proofRef.current?.click()}
                    >
                      {proofBusy
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <Receipt className="h-4 w-4 mr-1" />}
                      Upload proof of payment
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
