import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HeartHandshake, ShieldCheck, Heart } from "lucide-react";
import { listPublishedCampaigns, campaignEffectiveStatus, canDonateToCampaign } from "@/lib/help-now-campaigns-api";
import { CampaignExpiryBadge } from "@/components/help-now/CampaignExpiryBadge";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    .format(Number(n ?? 0));

export function HelpNowCampaigns() {
  const { data, isLoading } = useQuery({
    queryKey: ["helpNowCampaigns"],
    queryFn: () => listPublishedCampaigns(10),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (!data?.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <HeartHandshake className="h-4 w-4 text-primary" /> Funding cases
      </h2>
      {data.map((c) => {
        const remaining = Math.max(0, Number(c.goal_amount) - Number(c.raised_amount));
        const pct = Number(c.goal_amount) > 0
          ? Math.min(100, (Number(c.raised_amount) / Number(c.goal_amount)) * 100) : 0;
        const status = campaignEffectiveStatus(c) ?? c.status;
        const canDonate = canDonateToCampaign(c);
        return (
          <Card key={c.id} className="overflow-hidden">
            {c.photo_urls?.[0] && (
              <img
                src={c.photo_urls[0]}
                alt={c.title ?? `${c.pet?.name ?? "Pet"} funding case`}
                loading="lazy"
                className="w-full aspect-[4/3] object-cover"
              />
            )}
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.title ?? `Help ${c.pet?.name ?? "this pet"}`}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.story}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={status === "expired" ? "destructive" : status === "funded" ? "default" : "secondary"}>
                    {status}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> {c.verification_status}
                  </Badge>
                </div>
              </div>
              <Progress value={pct} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{fmt(c.raised_amount)} raised of {fmt(c.goal_amount)}</span>
                <span>{fmt(remaining)} still needed</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CampaignExpiryBadge campaign={c} />
                <Button size="sm" disabled={!canDonate}>
                  <Heart className="h-4 w-4 mr-1" />
                  {canDonate ? "Donate" : "Donations closed"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
