import { toast } from "@/hooks/use-toast";

/**
 * Redirects the top-level browser tab to a Stripe Checkout (or Billing Portal)
 * URL. Stripe Checkout refuses to render inside iframes, so when the app is
 * embedded (e.g. Lovable preview iframe), we must escape the iframe by
 * navigating the top frame. We do this with an anchor click using
 * `target="_top"`, which works even across cross-origin parents (where
 * `window.top.location` would throw).
 *
 * On the published site / custom domain (no iframe), we just navigate the
 * current tab normally.
 *
 * Returns true if navigation was issued, false otherwise.
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

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true; // cross-origin access throws → we are framed
    }
  })();

  // Same-origin top frame (or not embedded): direct navigation.
  if (!inIframe) {
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

  // Try same-origin top-frame navigation first (works on published custom
  // domain even if technically framed by something same-origin).
  try {
    if (window.top) {
      window.top.location.href = url;
      return true;
    }
  } catch {
    /* cross-origin parent — fall through to anchor fallback */
  }

  // Cross-origin iframe (e.g. Lovable preview): use an anchor with
  // target="_top" to break out without needing access to window.top.location.
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_top";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
