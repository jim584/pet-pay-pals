import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { FurensicPlayer } from "./FurensicPlayer";
import type { FurensicEntry } from "@/lib/furensic-api";

const KIND_LABEL: Record<string, string> = {
  blog: "Blog",
  video: "Video",
  podcast: "Podcast",
};

export function FurensicEntryCard({
  entry,
  canManage,
  onEdit,
  onDelete,
}: {
  entry: FurensicEntry;
  canManage?: boolean;
  onEdit?: (entry: FurensicEntry) => void;
  onDelete?: (entry: FurensicEntry) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {KIND_LABEL[entry.kind] ?? entry.kind}
              </Badge>
              {!entry.is_published && (
                <Badge variant="outline" className="text-xs">Draft</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(entry.published_at).toLocaleDateString()}
              </span>
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground">
              {entry.title}
            </h3>
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit?.(entry)} aria-label="Edit entry">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete?.(entry)} aria-label="Delete entry">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {entry.media_url ? (
          <FurensicPlayer entry={entry} />
        ) : entry.cover_image_url ? (
          <img
            src={entry.cover_image_url}
            alt={entry.title}
            loading="lazy"
            className="w-full rounded-lg object-cover aspect-video"
          />
        ) : null}

        {entry.summary && (
          <p className="text-sm text-muted-foreground">{entry.summary}</p>
        )}
        {entry.body && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {entry.body}
          </p>
        )}

        {entry.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {entry.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[11px]">
                #{t}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
