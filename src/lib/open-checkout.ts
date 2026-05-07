import { toast } from "sonner";

/**
 * Opens an external Stripe Checkout (or similar hosted) URL in a new tab
 * WITHOUT ever navigating the current app tab.
 *
 * - If the popup opens: show a confirmation toast and leave the app alone.
 * - If the browser blocks the popup: show a persistent toast with a
 *   "Continue to checkout" action button so the user can retry from a
 *   fresh click gesture (which browsers reliably allow).
 *
 * Returns true if the new tab opened, false if it was blocked.
 */
export function openCheckoutUrl(url: string): boolean {
  if (!url) return false;

  let win: Window | null = null;
  try {
    win = window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    win = null;
  }

  if (win) {
    toast.success("Opening secure checkout", {
      description: "Stripe opened in a new tab. Complete payment there, then return here.",
    });
    return true;
  }

  // Popup was blocked. Do NOT navigate the current tab — that would replace
  // the app with Stripe's loading skeleton. Surface a persistent toast with
  // a one-click retry instead.
  toast("Popup blocked", {
    description: "Your browser blocked the checkout window. Click Continue to open it.",
    duration: Infinity,
    action: {
      label: "Continue to checkout",
      onClick: () => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
  });
  return false;
}
