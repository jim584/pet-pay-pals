import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  REDIRECTION_DISCLOSURE, startCampaignDonation, campaignRemainingEligible,
  type PublicCampaign,
} from "@/lib/help-now-campaigns-api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

const PRESETS = [25, 50, 100, 250];

export function DonateDialog({ campaign, disabled }: { campaign: PublicCampaign; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("50");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remaining = campaignRemainingEligible(campaign);
  const value = Number(amount);
  const invalid = !Number.isFinite(value) || value <= 0 || value > remaining;

  const submit = async () => {
    if (invalid || !acknowledged) return;
    setSubmitting(true);
    try {
      const url = await startCampaignDonation({
        campaign_id: campaign.id,
        amount: value,
        donor_name: name || undefined,
        donor_email: email || undefined,
        message: message || undefined,
      });
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message || "Could not start the donation");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Heart className="h-4 w-4 mr-1" />
          {disabled ? "Donations closed" : "Donate"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.title ?? `Help ${campaign.pet?.name ?? "this pet"}`}</DialogTitle>
          <DialogDescription>
            {fmt(remaining)} still needed toward this verified veterinary expense.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.filter((p) => p <= remaining).map((p) => (
              <Button
                key={p}
                type="button"
                variant={Number(amount) === p ? "default" : "outline"}
                size="sm"
                onClick={() => setAmount(String(p))}
              >
                {fmt(p)}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="donation-amount">Amount (USD)</Label>
            <Input
              id="donation-amount"
              type="number"
              min="1"
              max={remaining}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {value > remaining && (
              <p className="text-xs text-destructive">
                This case can only accept up to {fmt(remaining)} more.
              </p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="donor-name">Your name (optional)</Label>
              <Input id="donor-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donor-email">Email for updates</Label>
              <Input
                id="donor-email"
                type="email"
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor-message">Message (optional)</Label>
            <Textarea
              id="donor-message"
              maxLength={250}
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              {REDIRECTION_DISCLOSURE}
            </AlertDescription>
          </Alert>

          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              aria-label="Acknowledge the redirection policy"
            />
            <span>
              I understand my donation funds a verified veterinary expense and may be redirected to
              another verified Help a Pet Now case if this one is not verified in time.
            </span>
          </label>

          <Button className="w-full" onClick={submit} disabled={invalid || !acknowledged || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Donate {Number.isFinite(value) && value > 0 ? fmt(value) : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
