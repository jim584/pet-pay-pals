import { ImgHTMLAttributes } from "react";
import prayingHandsSrc from "@/assets/praying-hands.png";

interface PrayingHandsProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  className?: string;
}

export function PrayingHands({ className, style, ...props }: PrayingHandsProps) {
  return (
    <img
      src={prayingHandsSrc}
      alt="Like"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      draggable={false}
      {...props}
    />
  );
}
