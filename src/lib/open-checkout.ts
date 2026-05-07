import { toast } from "@/hooks/use-toast";

/**
 * Redirects the current tab to an external Stripe Checkout (or similar hosted) URL.
 *
 * Navigates the top-level window in place so the app tab isn't left idle in a
 * new tab. Stripe's success_url / cancel_url bring the user back to the app
 * after completing or cancelling.
 *
 * Returns true if a top-frame navigation was issued, false if it fell back to
 * the current window.
 */
export function openCheckoutUrl(url: string): boolean {
  if (!url) return false;

  toast({
    title: "Redirecting to secure checkout",
    description: "Taking you to Stripe to complete payment…",
  });

  // If we're inside an iframe (e.g. Lovable preview), try to break out so
  // Stripe loads top-level instead of inside the iframe.
  try {
    if (window.top && window.top !== window.self) {
      (window.top as Window).location.href = url;
      return true;
    }
  } catch {
    /* cross-origin parent — fall through to same-window navigation */
  }

  window.location.href = url;
  return false;
}
