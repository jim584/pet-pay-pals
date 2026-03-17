import { ImgHTMLAttributes, useState, useCallback } from "react";
import prayingHandsSrc from "@/assets/praying-hands.png";
import { cn } from "@/lib/utils";

interface PrayingHandsProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  className?: string;
}

export function PrayingHands({ className, style, onClick, ...props }: PrayingHandsProps) {
  const [bouncing, setBouncing] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      setBouncing(true);
      setTimeout(() => setBouncing(false), 400);
      onClick?.(e);
    },
    [onClick]
  );

  return (
    <img
      src={prayingHandsSrc}
      alt="Like"
      className={cn(className, bouncing && "animate-bounce-scale")}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      draggable={false}
      onClick={handleClick}
      {...props}
    />
  );
}
