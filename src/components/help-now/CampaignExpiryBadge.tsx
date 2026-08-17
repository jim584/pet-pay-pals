import { Badge } from "@/components/ui/badge";
import { Clock, PauseCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  campaignDaysRemaining, campaignEffectiveStatus,
  type HelpNowCampaign,
} from "@/lib/help-now-campaigns-api";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * Shows where an estimate-backed campaign stands against its 60-day invoice deadline.
 * Renders nothing once the campaign is invoice-backed and off the clock.
 */
export function CampaignExpiryBadge({
  campaign,
  className,
}: {
  campaign: Pick<
    HelpNowCampaign,
    "status" | "document_basis" | "expires_at" | "clock_paused_at" | "invoice_status"
  >;
  className?: string;
}) {
  const c = campaign as HelpNowCampaign;
  const status = campaignEffectiveStatus(c);

  if (c.document_basis === "invoice") {
    return (
      <Badge variant="outline" className={`text-xs flex items-center gap-1 ${className ?? ""}`}>
        <ShieldCheck className="h-3 w-3" /> Invoice on file
      </Badge>
    );
  }

  if (status === "expired") {
    return (
      <Badge variant="destructive" className={`text-xs flex items-center gap-1 ${className ?? ""}`}>
        <AlertTriangle className="h-3 w-3" /> Expired — invoice not provided
      </Badge>
    );
  }

  if (c.invoice_status === "submitted") {
    return (
      <Badge variant="secondary" className={`text-xs flex items-center gap-1 ${className ?? ""}`}>
        <PauseCircle className="h-3 w-3" /> Invoice under review — clock paused
      </Badge>
    );
  }

  if (!c.expires_at) return null;

  const days = campaignDaysRemaining(c) ?? 0;
  const urgent = days <= 7;

  return (
    <Badge
      variant={urgent ? "destructive" : "outline"}
      className={`text-xs flex items-center gap-1 ${className ?? ""}`}
    >
      <Clock className="h-3 w-3" />
      Invoice needed by {dateFmt(c.expires_at)} — {days} day{days === 1 ? "" : "s"} left
    </Badge>
  );
}
