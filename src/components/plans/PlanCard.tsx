import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import type { MembershipPlan } from "@/lib/plans-api";

interface Props {
  plan: MembershipPlan;
  isFearFree: boolean;
  billingInterval: "month" | "year";
  onSubscribe: (plan: MembershipPlan) => Promise<void>;
  isCurrent?: boolean;
  isCurrentInterval?: boolean;
}

const tierAccent: Record<string, string> = {
  bronze: "border-amber-700/30",
  silver: "border-slate-400/40",
  gold: "border-yellow-500/40",
  platinum: "border-primary/50 ring-1 ring-primary/20",
};

export function PlanCard({ plan, isFearFree, billingInterval, onSubscribe, isCurrent = false, isCurrentInterval = false }: Props) {
  const [loading, setLoading] = useState(false);

  const monthly = isFearFree ? plan.fear_free_member_charge : plan.membership_fee;
  const annualMembership = isFearFree ? plan.fear_free_member_charge * 12 : plan.annual_price;
  const displayMembership = billingInterval === "year" ? annualMembership : monthly;
  const platformDisplay = billingInterval === "year" ? plan.platform_fee * 12 : plan.platform_fee;
  const totalDisplay = displayMembership + platformDisplay;

  const handle = async () => {
    setLoading(true);
    try { await onSubscribe(plan); } finally { setLoading(false); }
  };

  return (
    <Card className={`flex flex-col ${tierAccent[plan.tier]} ${isCurrent ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge variant="secondary" className="capitalize">{plan.tier}</Badge>
          <div className="flex gap-1.5">
            {isCurrent && <Badge className="bg-primary">Active</Badge>}
            {plan.tier === "platinum" && !isCurrent && <Badge>Most flexible</Badge>}
          </div>
        </div>
        <CardTitle className="font-display text-2xl mt-2">{plan.tier_label}</CardTitle>
        <p className="text-xs text-muted-foreground capitalize">{plan.species} plan</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-display">${totalDisplay.toFixed(2)}</span>
            <span className="text-sm text-muted-foreground">/{billingInterval}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ${displayMembership.toFixed(2)} membership + ${platformDisplay.toFixed(2)} platform fee
          </p>
          {isFearFree && (
            <p className="text-xs text-accent mt-1">Fear Free 5% discount applied to membership</p>
          )}
        </div>

        <ul className="space-y-2 text-sm flex-1">
          <li className="flex gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            Plan cap: {plan.plan_cap ? `$${plan.plan_cap.toLocaleString()}` : "Unlimited"}
          </li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            Direct Pay window: {plan.dp_window_months ? `${plan.dp_window_months} months` : "No auto-expiry"}
          </li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            Max Direct Pay: {plan.max_dp_amount ? `$${plan.max_dp_amount.toLocaleString()}` : "Unlimited"}
          </li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            70/20/10 split: ${plan.direct_pay_portion}/${plan.admin_portion}/${plan.reserve_portion} per month
          </li>
        </ul>

        <Button
          onClick={handle}
          disabled={loading || (isCurrent && isCurrentInterval)}
          variant={isCurrent && isCurrentInterval ? "secondary" : "default"}
          className="w-full"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
            isCurrent && isCurrentInterval ? "Current plan" :
            isCurrent ? "Switch billing" : "Subscribe"}
        </Button>
      </CardContent>
    </Card>
  );
}
