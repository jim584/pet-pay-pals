import { SVGProps } from "react";

export function PrayingHands({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left hand */}
      <path d="M9.5 3.5c-.3.1-.5.4-.5.7v6.3l-1.5 2.5c-.3.5-.5 1-.5 1.5v3c0 1.7 1.3 3 3 3h1" />
      <path d="M9 10.5V4a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v6" />
      <path d="M7.5 12L6 10a1 1 0 0 0-1.7 0l-.3.5a2 2 0 0 0 .1 2.1L7 16" />
      {/* Right hand */}
      <path d="M14.5 3.5c.3.1.5.4.5.7v6.3l1.5 2.5c.3.5.5 1 .5 1.5v3c0 1.7-1.3 3-3 3h-1" />
      <path d="M15 10.5V4a1 1 0 0 0-1-1h0a1 1 0 0 0-1 1v6" />
      <path d="M16.5 12L18 10a1 1 0 0 1 1.7 0l.3.5a2 2 0 0 1-.1 2.1L17 16" />
      {/* Center line */}
      <line x1="12" y1="3" x2="12" y2="20.5" />
    </svg>
  );
}
