import { toast } from "@/hooks/use-toast";

/**
 * Redirects the current browser tab to a Stripe Checkout (or Billing Portal)
 * URL. Uses plain `window.location` navigation so it works reliably in both
 * the published app and embedded previews. Returns true if navigation was
 * issued, false otherwise.
 *
 * Note: Stripe Checkout refuses to render inside iframes, so when used inside
 * the Lovable preview iframe the destination page may not render fully — this
 * is expected. On the published site / custom domain it works normally.
 */
export function openCheckoutUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    toast({
      title: "Couldn't open checkout",
      description: "No checkout URL was returned. Please try again.",
      variant: "destructive",
    });
    return false;
  }

  toast({
    title: "Redirecting to secure checkout",
    description: "Taking you to Stripe to complete payment…",
  });

  try {
    window.location.assign(url);
    return true;
  } catch {
    try {
      window.location.href = url;
      return true;
    } catch (e) {
      toast({
        title: "Couldn't open checkout",
        description: (e as Error)?.message || "Navigation was blocked.",
        variant: "destructive",
      });
      return false;
    }
  }
}
