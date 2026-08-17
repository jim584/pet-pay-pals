import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRightLeft, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  actOnRedirection, listRedirectionAllocations, listRedirections,
  type CampaignRedirection,
} from "@/lib/help-now-campaigns-api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

type Proposal = {
  total: number;
  unallocated: number;
  allocations: { receiving_campaign_id: string; amount: number }[];
  cases: { id: string; title: string | null; remaining: number }[];
};

function RedirectionCard({ r }: { r: CampaignRedirection }) {
  const qc = useQueryClient();
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const { data: allocations } = useQuery({
    queryKey: ["redirectionAllocations", r.id],
    queryFn: () => listRedirectionAllocations(r.id),
    enabled: r.status !== "pending",
  });

  const act = useMutation({
    mutationFn: (action: "propose" | "release" | "cancel") =>
      actOnRedirection({
        redirection_id: r.id,
        action,
        allocations: action === "release" ? proposal?.allocations : undefined,
      }),
    onSuccess: (data, action) => {
      if (action === "propose") {
        setProposal({
          total: Number(data.total ?? 0),
          unallocated: Number(data.unallocated ?? 0),
          allocations: data.allocations ?? [],
          cases: data.cases ?? [],
        });
        return;
      }
      if (action === "release") {
        toast.success(
          `Released ${fmt(Number(data.allocated ?? 0))} to verified cases; ${data.notified ?? 0} donors notified`,
        );
      } else {
        toast.success("Redirection cancelled");
      }
      qc.invalidateQueries({ queryKey: ["campaignRedirections"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const caseTitle = (id: string) =>
    proposal?.cases.find((c) => c.id === id)?.title ?? id.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {r.source?.title ?? r.source?.pet?.name ?? "Expired campaign"}
            </CardTitle>
            <CardDescription>
              {fmt(r.total_amount)} held · expired without verified invoice and proof of payment
            </CardDescription>
          </div>
          <Badge variant={r.status === "pending" ? "secondary" : r.status === "released" ? "default" : "outline"}>
            {r.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {r.status === "pending" && (
          <>
            <Button size="sm" variant="outline" onClick={() => act.mutate("propose")} disabled={act.isPending}>
              {act.isPending && act.variables === "propose" && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Preview allocation
            </Button>

            {proposal && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {fmt(proposal.total)} to distribute in priority order
                </p>
                {proposal.allocations.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No verified case can currently receive these funds. Try again once another case has
                    an accepted invoice and verified proof of payment.
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {proposal.allocations.map((a) => (
                      <li key={a.receiving_campaign_id} className="flex justify-between gap-2">
                        <span>{caseTitle(a.receiving_campaign_id)}</span>
                        <span className="font-medium">{fmt(a.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {proposal.unallocated > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {fmt(proposal.unallocated)} cannot be placed yet and stays held.
                  </p>
                )}
                <Separator />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => act.mutate("release")}
                    disabled={act.isPending || proposal.allocations.length === 0}
                  >
                    Release and notify donors
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act.mutate("cancel")}
                    disabled={act.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {r.status !== "pending" && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              {fmt(r.allocated_amount)} allocated
              {r.unallocated_amount > 0 ? ` · ${fmt(r.unallocated_amount)} still held` : ""}
            </p>
            {(allocations ?? []).map((a) => (
              <div key={a.id} className="flex justify-between gap-2">
                <span>{a.receiving_campaign_id.slice(0, 8)}</span>
                <span>{fmt(a.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminRedirectionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaignRedirections"],
    queryFn: () => listRedirections(),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" /> Donation redirections
        </h1>
        <p className="text-sm text-muted-foreground">
          Donations held on expired, unverified estimate campaigns. These are never paid to the
          original member — they move to Help a Pet Now cases that already have verified documentation.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Receiving cases are ordered oldest-verified-first until the official Help a Pet Now priority
          hierarchy is finalised. Only cases with an accepted invoice and cleared disbursement can receive funds.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No redirections yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((r) => <RedirectionCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
