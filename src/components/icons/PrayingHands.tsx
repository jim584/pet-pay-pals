import { SVGProps } from "react";

export function PrayingHands({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left hand */}
      <path d="M12 2.5c-1.5 1-3 3.5-3.5 5.5-.4 1.5-.5 3-.5 4l-1.8 3.5c-.3.6-.2 1.2.2 1.7l2.6 3.3c.4.5 1 .8 1.6.8H12" />
      <path d="M8.5 12c-.8-.5-1.5-.3-1.8.2-.4.6-.1 1.3.5 1.8" />
      {/* Right hand */}
      <path d="M12 2.5c1.5 1 3 3.5 3.5 5.5.4 1.5.5 3 .5 4l1.8 3.5c.3.6.2 1.2-.2 1.7l-2.6 3.3c-.4.5-1 .8-1.6.8H12" />
      <path d="M15.5 12c.8-.5 1.5-.3 1.8.2.4.6.1 1.3-.5 1.8" />
      {/* Fingers / center detail */}
      <path d="M10 8c.5-1 1.2-1.5 2-1.5s1.5.5 2 1.5" />
      <path d="M9.5 10.5c.7-.3 1.5-.5 2.5-.5s1.8.2 2.5.5" />
    </svg>
  );
}
