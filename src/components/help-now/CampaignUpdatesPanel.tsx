import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, ImagePlus, X, MessageSquareHeart, AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { HelpNowCampaign } from "@/lib/help-now-campaigns-api";
import {
  listCampaignUpdates, postCampaignUpdate, uploadUpdatePhoto, campaignUpdateStatus,
  MIN_UPDATE_LENGTH, UPDATE_INTERVAL_DAYS,
  type CampaignUpdate, type CampaignUpdateKind,
} from "@/lib/campaign-updates-api";

const KIND_LABEL: Record<CampaignUpdateKind, string> = {
  initial: "Story",
  treatment: "Treatment update",
  progress: "Progress update",
};

export function CampaignUpdatesPanel({
  campaign,
  onChange,
}: {
  campaign: HelpNowCampaign;
  onChange?: (c: HelpNowCampaign) => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.id === campaign.owner_id;
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    listCampaignUpdates(campaign.id)
      .then((rows) => alive && setUpdates(rows))
      .catch(() => {});
    return () => { alive = false; };
  }, [campaign.id, campaign.last_required_update_at]);

  const status = campaignUpdateStatus(campaign);
  const kind: CampaignUpdateKind = status.dueKind === "treatment" ? "treatment" : "progress";
  const photoRequired = kind === "treatment";
  const canPost =
    body.trim().length >= MIN_UPDATE_LENGTH && (!photoRequired || photos.length > 0);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 3)) urls.push(await uploadUpdatePhoto(user.id, f));
      setPhotos((p) => [...p, ...urls].slice(0, 4));
    } catch (e: any) {
      toast({ title: "Couldn't upload photo", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const post = async () => {
    setPosting(true);
    try {
      const res = await postCampaignUpdate({
        campaignId: campaign.id, kind, body: body.trim(), photoUrls: photos,
      });
      setUpdates((u) => [res.update, ...u]);
      setBody("");
      setPhotos([]);
      onChange?.(res.campaign);
      toast({
        title: "Update posted",
        description: status.paused
          ? "Thanks — the disbursement process can resume."
          : "Your donors can now see how your pet is doing.",
      });
    } catch (e: any) {
      const msg = e.message === "photo_required" ? "Add a current photo of your pet." : e.message;
      toast({ title: "Couldn't post the update", description: msg, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <MessageSquareHeart className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Community updates</p>
            <p className="text-xs text-muted-foreground">{status.detail}</p>
          </div>
        </div>
        <Badge variant={status.paused ? "destructive" : status.dueKind ? "secondary" : "outline"}>
          {status.label}
        </Badge>
      </div>

      {status.paused && (
        <p className="text-xs text-destructive flex items-start gap-1">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Disbursements are paused until this update is posted. Your case stays open and donations
          already received are unaffected.
        </p>
      )}

      {isOwner && (
        <div className="space-y-2">
          <Label className="text-xs">
            {KIND_LABEL[kind]}
            {photoRequired ? " (photo required)" : ""}
          </Label>
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              kind === "treatment"
                ? "Tell the community how the treatment went and how your pet is doing now."
                : "Share how your pet is doing since your last update."
            }
          />
          <p className="text-xs text-muted-foreground">
            {body.trim().length}/{MIN_UPDATE_LENGTH} characters minimum — an update is expected at
            least every {UPDATE_INTERVAL_DAYS} days while your case is live.
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p} className="relative">
                <img src={p} alt="Update" className="h-16 w-16 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((cur) => cur.filter((x) => x !== p))}
                  className="absolute -top-1 -right-1 rounded-full bg-background border p-0.5"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="h-16 w-16 rounded border border-dashed flex items-center justify-center cursor-pointer">
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => addPhotos(e.target.files)} />
            </label>
          </div>
          <Button size="sm" onClick={post} disabled={posting || !canPost}>
            {posting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Post {KIND_LABEL[kind].toLowerCase()}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {updates.length === 0 && (
          <p className="text-xs text-muted-foreground">No updates posted yet.</p>
        )}
        {updates.map((u) => (
          <article key={u.id} className="rounded border p-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-[10px]">{KIND_LABEL[u.kind]}</Badge>
              <time className="text-[11px] text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString()}
              </time>
            </div>
            <p className="text-sm whitespace-pre-wrap">{u.body}</p>
            {u.photo_urls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {u.photo_urls.map((p) => (
                  <img key={p} src={p} alt="Pet update" loading="lazy"
                    className="h-20 w-20 rounded object-cover" />
                ))}
              </div>
            )}
            {u.public_verification_url && (
              <a href={u.public_verification_url} target="_blank" rel="noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                View the redacted veterinary verification
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
