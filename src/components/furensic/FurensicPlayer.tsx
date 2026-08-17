import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play } from "lucide-react";
import { providerLabel, type FurensicEntry } from "@/lib/furensic-api";

/**
 * Plays supported media (YouTube, Vimeo, Spotify) inside Help a Pet.
 * The original source link is always offered too — users are never forced
 * off-platform to watch, and never blocked from the original video.
 */
export function FurensicPlayer({ entry }: { entry: FurensicEntry }) {
  const [playing, setPlaying] = useState(false);
  if (!entry.media_url) return null;

  const canEmbed = Boolean(entry.embed_url);
  const isAudio = entry.media_provider === "spotify";

  return (
    <div className="space-y-2">
      {canEmbed && (playing || isAudio) ? (
        <div className={isAudio ? "" : "relative w-full aspect-video overflow-hidden rounded-lg bg-muted"}>
          <iframe
            src={entry.embed_url!}
            title={entry.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className={isAudio ? "w-full rounded-lg border" : "absolute inset-0 h-full w-full"}
            style={isAudio ? { height: 152 } : undefined}
          />
        </div>
      ) : canEmbed ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${entry.title}`}
          className="group relative block w-full aspect-video overflow-hidden rounded-lg bg-muted"
        >
          {entry.cover_image_url ? (
            <img
              src={entry.cover_image_url}
              alt={`Thumbnail for ${entry.title}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/25">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/90 shadow">
              <Play className="h-6 w-6 text-primary" />
            </span>
          </span>
        </button>
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
          <a href={entry.media_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Open on {providerLabel(entry.media_provider)}
          </a>
        </Button>
        {entry.duration_label && (
          <span className="text-xs text-muted-foreground">{entry.duration_label}</span>
        )}
      </div>
    </div>
  );
}
