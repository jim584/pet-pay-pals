import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { campaignDisbursementState, type HelpNowCampaign } from "@/lib/help-now-campaigns-api";

/**
 * Requirement 12 — shows whether campaign funds may be released yet:
 * direct vet payment, verified reimbursement, or not eligible.
 */
export function DisbursementReadinessBadge({ campaign }: { campaign: HelpNowCampaign }) {
  const state = campaignDisbursementState(campaign);
  return (
    <Badge variant={state.eligible ? "default" : "secondary"} className="gap-1" title={state.detail}>
      {state.eligible ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {state.label}
    </Badge>
  );
}
