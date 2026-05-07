import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchPlans, startCheckout, MembershipPlan } from "@/lib/plans-api";
import { PlanCard } from "@/components/plans/PlanCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function PlansPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [isFearFree, setIsFearFree] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    setLoadingPlans(true);
    fetchPlans(species).then(setPlans).finally(() => setLoadingPlans(false));
  }, [species]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const handleSubscribe = async (plan: MembershipPlan) => {
    try {
      const url = await startCheckout({
        plan_id: plan.id,
        billing_interval: billingInterval,
        is_fear_free_member: isFearFree,
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Could not start checkout");
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
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

        <div className="flex items-center gap-2">
          <Label htmlFor="ff">Fear Free member (5% off membership)</Label>
          <Switch id="ff" checked={isFearFree} onCheckedChange={setIsFearFree} />
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
