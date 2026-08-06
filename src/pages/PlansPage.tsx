import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchPlans, startCheckout, fetchMyMembership, openCustomerPortal, MembershipPlan, Membership } from "@/lib/plans-api";
import { PlanCard } from "@/components/plans/PlanCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { openCheckoutUrl } from "@/lib/open-checkout";

type PetOption = { id: string; name: string; species: string; vet_of_record_id: string | null };

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
  const [pets, setPets] = useState<PetOption[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [coveredPetIds, setCoveredPetIds] = useState<Set<string>>(new Set());

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

  // Load the user's pets; a membership is always bound to one specific pet.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, species, vet_of_record_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
      const list = (data ?? []) as PetOption[];
      setPets(list);
      const { data: covered } = await supabase
        .from("memberships")
        .select("pet_id")
        .eq("user_id", user.id)
        .in("status", ["active", "past_due", "pending"]);
      const coveredIds = new Set((covered ?? []).map((m: any) => m.pet_id).filter(Boolean));
      setCoveredPetIds(coveredIds);
      const firstFree = list.find((p) => !coveredIds.has(p.id));
      setSelectedPetId((prev) => prev ?? firstFree?.id ?? list[0]?.id ?? null);
    })();
  }, [user]);

  // Fear Free status is derived from the SELECTED pet's Vet of Record only.
  useEffect(() => {
    const pet = pets.find((p) => p.id === selectedPetId);
    if (!pet) {
      setIsFearFree(false);
      setFearFreeReason("Add a pet to see your membership pricing.");
      return;
    }
    if (pet.species === "dog" || pet.species === "cat") setSpecies(pet.species);
    if (!pet.vet_of_record_id) {
      setIsFearFree(false);
      setFearFreeReason(`Add a Vet of Record to ${pet.name} to qualify for Fear Free pricing.`);
      return;
    }
    (async () => {
      const { data: vets } = await supabase
        .from("vet_profiles")
        .select("fear_free_certified, clinic_name")
        .eq("id", pet.vet_of_record_id!)
        .eq("fear_free_certified", true);
      if (vets && vets.length > 0) {
        setIsFearFree(true);
        setFearFreeReason(`Verified via ${pet.name}'s Vet of Record (${vets[0].clinic_name}).`);
      } else {
        setIsFearFree(false);
        setFearFreeReason(`${pet.name}'s Vet of Record isn't Fear Free certified yet.`);
      }
    })();
  }, [pets, selectedPetId]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const handleSubscribe = async (plan: MembershipPlan) => {
    try {
      if (pets.length === 0) {
        toast.error("Add your pet first", {
          description: "Your membership is tied to a pet. Add one to continue.",
        });
        navigate("/dashboard/pets");
        return;
      }
      if (!selectedPetId) {
        toast.error("Choose a pet", { description: "Select which pet this membership covers." });
        return;
      }
      if (coveredPetIds.has(selectedPetId)) {
        toast.error("Already covered", { description: "That pet already has a membership." });
        return;
      }

      const url = await startCheckout({
        plan_id: plan.id,
        pet_id: selectedPetId,
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

      <Card>
        <CardContent className="p-5 space-y-2">
          <Label htmlFor="pet-select">Which pet is this membership for?</Label>
          {pets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a pet first — every membership, benefit and payment plan is tied to one pet.{" "}
              <Button variant="link" className="px-1 h-auto" onClick={() => navigate("/dashboard/pets")}>
                Add a pet
              </Button>
            </p>
          ) : (
            <>
              <Select value={selectedPetId ?? undefined} onValueChange={setSelectedPetId}>
                <SelectTrigger id="pet-select" className="max-w-sm">
                  <SelectValue placeholder="Select a pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={coveredPetIds.has(p.id)}>
                      {p.name} · {p.species}
                      {coveredPetIds.has(p.id) ? " (already covered)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Direct Pay, Reserve and payment plans all accrue to this pet.
              </p>
            </>
          )}
        </CardContent>
      </Card>


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
