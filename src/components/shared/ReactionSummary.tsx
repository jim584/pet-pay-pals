import { getReaction } from "@/lib/reactions";
import { PrayingHands } from "@/components/icons/PrayingHands";

interface ReactionSummaryProps {
  summary: { type: string; count: number }[];
}

export function ReactionSummary({ summary }: ReactionSummaryProps) {
  if (!summary || summary.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {summary.map((item) => {
        const r = getReaction(item.type);
        return (
          <span
            key={item.type}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5"
          >
            {r.key === "pray" ? (
              <PrayingHands className="h-3.5 w-3.5" />
            ) : (
              <span className="text-sm leading-none">{r.emoji}</span>
            )}
            <span className="font-medium">{item.count}</span>
          </span>
        );
      })}
    </div>
  );
}
