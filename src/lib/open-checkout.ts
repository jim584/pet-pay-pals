import { toast } from "@/hooks/use-toast";

/**
 * Opens an external Stripe Checkout (or similar hosted) URL safely.
 *
 * Inside the Lovable preview iframe, `window.location.href = url` only navigates
 * the embedded frame, which can leave Stripe Checkout stuck on its skeleton.
 * This helper opens the URL in a new top-level browser tab and falls back to
 * a top-level navigation if the popup is blocked.
 *
 * Returns true if the new tab/window was opened, false if it fell back.
 */
export function openCheckoutUrl(url: string): boolean {
  if (!url) return false;
  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
      toast({
        title: "Opening secure checkout",
        description: "Stripe opened in a new tab. Complete payment there, then return here.",
      });
      return true;
    }
  } catch {
    /* fall through */
  }

  // Popup blocked or threw. Try to break out of any embedding iframe.
  try {
    if (window.top && window.top !== window.self) {
      (window.top as Window).location.href = url;
      return true;
    }
  } catch {
    /* cross-origin frame — cannot navigate parent */
  }

  // Last resort: navigate current window.
  window.location.href = url;
  return false;
}
