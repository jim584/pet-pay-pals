import { toast } from "@/hooks/use-toast";

/**
 * Redirects to an external Stripe Checkout (or similar hosted) URL in the
 * top-level browser tab. Stripe refuses to render inside iframes, so when the
 * app runs inside the Lovable preview iframe we must break out to the top
 * window. `window.top.location` throws on cross-origin parents, so we use an
 * anchor with target="_top" which the browser handles natively without
 * triggering the same-origin check.
 */
export function openCheckoutUrl(url: string): boolean {
  if (!url) return false;

  toast({
    title: "Redirecting to secure checkout",
    description: "Taking you to Stripe to complete payment…",
  });

  const inIframe = window.self !== window.top;

  // Same-origin top navigation (works on published site / custom domain).
  if (!inIframe) {
    window.location.href = url;
    return false;
  }

  // Try direct top-frame navigation (only works if same-origin parent).
  try {
    if (window.top) {
      window.top.location.href = url;
      return true;
    }
  } catch {
    /* cross-origin parent — use anchor fallback */
  }

  // Anchor with target="_top" breaks out of cross-origin iframes (e.g. Lovable
  // preview) without needing access to window.top.location.
  const a = document.createElement("a");
  a.href = url;
  a.target = "_top";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
