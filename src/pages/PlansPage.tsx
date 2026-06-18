import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchPlans, startCheckout, fetchMyMembership, openCustomerPortal, MembershipPlan, Membership } from "@/lib/plans-api";
import { PlanCard } from "@/components/plans/PlanCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { openCheckoutUrl } from "@/lib/open-checkout";

export default function PlansPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [isFearFree, setIsFearFree] = useState(false);
  const [fearFreeReason, setFearFreeReason] = useState<string>("Add a Vet of Record to your pet to qualify for Fear Free pricing.");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [membership, setMembership] = useState<(Membership & { plan: MembershipPlan }) | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    setLoadingPlans(true);
    fetchPlans(species).then(setPlans).finally(() => setLoadingPlans(false));
  }, [species]);

  // Load current membership
  useEffect(() => {
    if (!user) return;
    fetchMyMembership(user.id).then((m) => {
      if (!m) return;
      setMembership(m);
      if (m.plan?.species) setSpecies(m.plan.species);
      if (m.billing_interval) setBillingInterval(m.billing_interval);
    }).catch(() => {});
  }, [user]);

  // Auto-derive Fear Free status from any pet's Vet of Record
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pets } = await supabase
        .from("pets")
        .select("vet_of_record_id")
        .eq("owner_id", user.id);
      const vetIds = (pets ?? []).map((p: any) => p.vet_of_record_id).filter(Boolean);
      if (vetIds.length === 0) {
        setIsFearFree(false);
        setFearFreeReason("Add a Vet of Record to your pet to qualify for Fear Free pricing.");
        return;
      }
      const { data: vets } = await supabase
        .from("vet_profiles")
        .select("fear_free_certified, clinic_name")
        .in("id", vetIds)
        .eq("fear_free_certified", true);
      if (vets && vets.length > 0) {
        setIsFearFree(true);
        setFearFreeReason(`Verified via your Vet of Record (${vets[0].clinic_name}).`);
      } else {
        setIsFearFree(false);
        setFearFreeReason("Your Vet of Record isn't Fear Free certified yet.");
      }
    })();
  }, [user]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const handleSubscribe = async (plan: MembershipPlan) => {
    try {
      // Membership must be tied to a pet. Block checkout if user has no pet.
      const { count, error: petCountErr } = await supabase
        .from("pets")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      if (petCountErr) throw petCountErr;
      if (!count || count === 0) {
        toast.error("Add your pet first", {
          description: "Your membership is tied to a pet. Add one to continue.",
        });
        navigate("/dashboard/pets");
        return;
      }

      const url = await startCheckout({
        plan_id: plan.id,
        billing_interval: billingInterval,
      });
      openCheckoutUrl(url);
    } catch (e: any) {
      toast.error(e.message || "Could not start checkout");
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div>
        <h1 className="text-3xl font-bold font-display">Together™ Membership Plans</h1>
        <p className="text-muted-foreground mt-1">Choose a plan that fits your pet and budget.</p>
      </div>

      {membership && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Your current plan</span>
                <Badge variant="secondary" className="capitalize">{membership.status}</Badge>
              </div>
              <h2 className="text-xl font-semibold font-display">
                {membership.plan?.tier_label ?? "Membership"}
                <span className="text-muted-foreground text-sm font-normal ml-2 capitalize">
                  · {membership.plan?.species} · {membership.billing_interval === "year" ? "Annual" : "Monthly"}
                </span>
              </h2>
              {membership.plan && (
                <p className="text-sm text-muted-foreground">
                  ${(membership.billing_interval === "year"
                    ? (membership.is_fear_free_member ? membership.plan.fear_free_member_charge * 12 : membership.plan.annual_price) + membership.plan.platform_fee * 12
                    : (membership.is_fear_free_member ? membership.plan.fear_free_member_charge : membership.plan.membership_fee) + membership.plan.platform_fee
                  ).toFixed(2)} /{membership.billing_interval}
                  {membership.current_period_end && (
                    <> · Renews {new Date(membership.current_period_end).toLocaleDateString()}</>
                  )}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              disabled={portalLoading}
              onClick={async () => {
                setPortalLoading(true);
                try {
                  const url = await openCustomerPortal();
                  openCheckoutUrl(url);
                } catch (e: any) {
                  toast.error(e.message || "Could not open billing portal");
                } finally {
                  setPortalLoading(false);
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {portalLoading ? "Opening…" : "Manage subscription"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-6">
        <Tabs value={species} onValueChange={(v) => setSpecies(v as any)}>
          <TabsList>
            <TabsTrigger value="dog">Dogs</TabsTrigger>
            <TabsTrigger value="cat">Cats</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Label htmlFor="billing">Annual billing</Label>
          <Switch id="billing" checked={billingInterval === "year"}
            onCheckedChange={(v) => setBillingInterval(v ? "year" : "month")} />
        </div>

        <div className="flex items-center gap-2 text-sm">
          {isFearFree ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">
              ✓ Fear Free member (5% off membership)
            </span>
          ) : (
            <span className="text-muted-foreground">Fear Free pricing: not active</span>
          )}
          <span className="text-xs text-muted-foreground hidden md:inline">— {fearFreeReason}</span>
        </div>
      </div>

      <Card className="bg-muted/40 border-dashed">
        <CardContent className="p-5 text-sm space-y-1">
          <h3 className="font-semibold font-display">How fees work</h3>
          <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
            <li><strong>Base membership fee</strong> — set per plan above.</li>
            <li><strong>Platform fee:</strong> $10/month on monthly billing, $5/month on annual billing (saves you $60/year).</li>
            <li><strong>Transaction fee:</strong> 5% applied to donations and member payments processed through Help A Pet.</li>
            <li><strong>Allocation of your membership:</strong> 70% Direct Pay (your vet care), 20% Community Reserve Pool, 10% admin/operations.</li>
          </ul>
        </CardContent>
      </Card>



      {loadingPlans ? (
        <div className="text-muted-foreground animate-pulse">Loading plans…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} isFearFree={isFearFree}
              billingInterval={billingInterval} onSubscribe={handleSubscribe}
              isCurrent={membership?.plan_id === p.id}
              isCurrentInterval={membership?.plan_id === p.id && membership?.billing_interval === billingInterval} />
          ))}
        </div>
      )}
    </div>
  );
}
