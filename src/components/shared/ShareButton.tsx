import { useState } from "react";
import { Share2, Copy, Check, Twitter, Facebook, Link } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  storyId: string;
  title: string;
  className?: string;
  iconClassName?: string;
}

export function ShareButton({ storyId, title, className, iconClassName }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/story/${storyId}`;
  const shareText = title;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => { setCopied(false); setOpen(false); }, 1200);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
        setOpen(false);
      } catch {
        // User cancelled
      }
    }
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
    setOpen(false);
  };

  const socials = [
    {
      label: "Twitter / X",
      icon: Twitter,
      action: () => openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`),
    },
    {
      label: "Facebook",
      icon: Facebook,
      action: () => openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`),
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn("flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors", className)}>
          <Share2 className={cn("h-5 w-5", iconClassName)} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start" sideOffset={8}>
        <div className="space-y-0.5">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-accent" /> : <Link className="h-4 w-4" />}
            <span>{copied ? "Copied!" : "Copy link"}</span>
          </button>

          {typeof navigator.share === "function" && (
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Share2 className="h-4 w-4" />
              <span>Share via…</span>
            </button>
          )}

          <div className="h-px bg-border my-1" />

          {socials.map((s) => (
            <button
              key={s.label}
              onClick={s.action}
              className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors"
            >
              <s.icon className="h-4 w-4" />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
