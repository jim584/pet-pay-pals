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

      {loadingPlans ? (
        <div className="text-muted-foreground animate-pulse">Loading plans…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} isFearFree={isFearFree}
              billingInterval={billingInterval} onSubscribe={handleSubscribe} />
          ))}
        </div>
      )}
    </div>
  );
}
