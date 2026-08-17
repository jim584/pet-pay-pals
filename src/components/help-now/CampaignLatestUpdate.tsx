import { useEffect, useState } from "react";
import { ShieldCheck, MessageSquareHeart } from "lucide-react";
import { listCampaignUpdates, type CampaignUpdate } from "@/lib/campaign-updates-api";

/**
 * Requirement 15 — donors see the member's most recent required update, plus the
 * platform-generated redacted verification link when one exists for the case.
 */
export function CampaignLatestUpdate({ campaignId }: { campaignId: string }) {
  const [update, setUpdate] = useState<CampaignUpdate | null>(null);

  useEffect(() => {
    let alive = true;
    listCampaignUpdates(campaignId)
      .then((rows) => {
        if (!alive) return;
        setUpdate(rows.find((r) => r.kind !== "initial") ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [campaignId]);

  if (!update) return null;

  return (
    <div className="rounded-md bg-muted/50 p-2 space-y-1">
      <p className="text-[11px] font-medium flex items-center gap-1 text-muted-foreground">
        <MessageSquareHeart className="h-3 w-3" />
        Latest update · {new Date(update.created_at).toLocaleDateString()}
      </p>
      <p className="text-xs line-clamp-3">{update.body}</p>
      {update.photo_urls[0] && (
        <img
          src={update.photo_urls[0]}
          alt="Latest pet update"
          loading="lazy"
          className="h-20 w-20 rounded object-cover"
        />
      )}
      {update.public_verification_url && (
        <a
          href={update.public_verification_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary inline-flex items-center gap-1"
        >
          <ShieldCheck className="h-3 w-3" /> Redacted veterinary verification
        </a>
      )}
    </div>
  );
}
