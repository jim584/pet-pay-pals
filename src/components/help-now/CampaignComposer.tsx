import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Loader2, HeartHandshake, ImagePlus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCampaignForTicket, updateCampaignContent, publishCampaign,
  uploadCampaignPhoto, campaignReadyToPublish, MIN_STORY_LENGTH,
  type HelpNowCampaign,
} from "@/lib/help-now-campaigns-api";
import { CampaignInvoicePanel } from "./CampaignInvoicePanel";
import { CampaignExpiryBadge } from "./CampaignExpiryBadge";
import { CampaignUpdatesPanel } from "./CampaignUpdatesPanel";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

export function CampaignComposer({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<HelpNowCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getCampaignForTicket(ticketId)
      .then((c) => {
        if (!alive) return;
        setCampaign(c);
        setTitle(c?.title ?? "");
        setStory(c?.story ?? "");
        setPhotos(c?.photo_urls ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [ticketId]);

  if (loading || !campaign) return null;

  const published = campaign.status !== "draft";
  const pct = campaign.goal_amount > 0
    ? Math.min(100, (Number(campaign.raised_amount) / Number(campaign.goal_amount)) * 100)
    : 0;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 4)) {
        urls.push(await uploadCampaignPhoto(user.id, f));
      }
      const next = [...photos, ...urls].slice(0, 6);
      setPhotos(next);
      const updated = await updateCampaignContent(campaign.id, { photo_urls: next });
      setCampaign(updated);
    } catch (e: any) {
      toast({ title: "Couldn't upload photo", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (url: string) => {
    const next = photos.filter((p) => p !== url);
    setPhotos(next);
    try {
      const updated = await updateCampaignContent(campaign.id, { photo_urls: next });
      setCampaign(updated);
    } catch { /* ignore */ }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const updated = await updateCampaignContent(campaign.id, {
        title: title.trim() || null, story: story.trim() || null, photo_urls: photos,
      });
      setCampaign(updated);
      toast({ title: "Draft saved" });
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const saved = await updateCampaignContent(campaign.id, {
        title: title.trim() || null, story: story.trim() || null, photo_urls: photos,
      });
      const published = await publishCampaign(saved.id);
      setCampaign(published);
      toast({ title: "Campaign published", description: "It's now live in the Help A Pet Now feed." });
    } catch (e: any) {
      const msg = e.message === "story_required"
        ? `Add at least ${MIN_STORY_LENGTH} characters to your story.`
        : e.message === "photo_required" ? "Add at least one photo." : e.message;
      toast({ title: "Couldn't publish", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const draftReady = campaignReadyToPublish({ ...campaign, story, photo_urls: photos });

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <HeartHandshake className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Help A Pet Now campaign — {fmt(campaign.goal_amount)}</p>
            <p className="text-xs text-muted-foreground">
              This is the amount still uncovered after Direct Pay and payment plans. We calculated
              the goal for you — you only need to add your story and a photo.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={published ? "default" : "outline"}>
            {published ? campaign.status : "draft"}
          </Badge>
          {!published && <CampaignExpiryBadge campaign={campaign} />}
        </div>
      </div>

      {published ? (
        <div className="space-y-2">
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground">
            {fmt(campaign.raised_amount)} raised of {fmt(campaign.goal_amount)} —{" "}
            {fmt(Math.max(0, Number(campaign.goal_amount) - Number(campaign.raised_amount)))} still needed
          </p>
          <CampaignInvoicePanel campaign={campaign} onChange={setCampaign} />
          <CampaignUpdatesPanel campaign={campaign} onChange={setCampaign} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Campaign title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Help Bella get her surgery" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Your story (required)</Label>
            <Textarea
              rows={4}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Tell the community what happened and what your pet needs — e.g. Rocky swallowed a string and needed surgery."
            />
            <p className="text-xs text-muted-foreground">
              {story.trim().length}/{MIN_STORY_LENGTH} characters minimum
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Photos (at least one required)</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p} className="relative">
                  <img src={p} alt="Campaign" className="h-16 w-16 rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p)}
                    className="absolute -top-1 -right-1 rounded-full bg-background border p-0.5"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-16 w-16 rounded border border-dashed flex items-center justify-center cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={saveDraft} disabled={saving}>Save draft</Button>
            <Button size="sm" onClick={publish} disabled={saving || !draftReady}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Publish campaign
            </Button>
          </div>
          {!draftReady && (
            <p className="text-xs text-muted-foreground">
              Add your story and at least one photo to publish. Publishing posts them as your
              case's first public update — Help a Pet Now funding always comes with social proof.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
