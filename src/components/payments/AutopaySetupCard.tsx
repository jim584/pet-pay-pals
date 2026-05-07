import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, ShieldCheck, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { confirmAutopaySetup, getAutopayStatus, startAutopaySetup } from "@/lib/bnpl-api";
import { openCheckoutUrl } from "@/lib/open-checkout";

interface Props {
  /** Triggered after redirect-back when autopay just completed setup, so parent can reload. */
  onSetupComplete?: () => void;
}

type ReturnState = "idle" | "confirming" | "needs_retry" | "cancelled";

export function AutopaySetupCard({ onSetupComplete }: Props) {
  const { user } = useAuth();
  const [pmId, setPmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<ReturnState>("idle");
  const handledReturn = useRef(false);

  const refresh = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = await getAutopayStatus(user.id);
      setPmId(s.default_payment_method_id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    if (handledReturn.current || !user) return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get("autopay");
    const sessionId = url.searchParams.get("session_id");

    const cleanUrl = () => {
      url.searchParams.delete("autopay");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    };

    if (status === "success") {
      handledReturn.current = true;
      setReturnState("confirming");
      (async () => {
        try {
          if (sessionId) {
            const res = await confirmAutopaySetup(sessionId);
            if (res.default_payment_method_id) {
              setPmId(res.default_payment_method_id);
              setReturnState("idle");
              toast({ title: "Autopay enabled", description: "Your card has been saved for installments." });
              onSetupComplete?.();
              return;
            }
          }
          // Fallback: maybe webhook beat us — re-check profile.
          const s = await getAutopayStatus(user.id).catch(() => null);
          if (s?.default_payment_method_id) {
            setPmId(s.default_payment_method_id);
            setReturnState("idle");
            onSetupComplete?.();
          } else {
            setReturnState("needs_retry");
          }
        } catch (e) {
          console.error("autopay confirm failed:", e);
          setReturnState("needs_retry");
          toast({ title: "Could not confirm card setup", description: (e as Error).message, variant: "destructive" });
        } finally {
          cleanUrl();
        }
      })();
    } else if (status === "cancelled") {
      handledReturn.current = true;
      setReturnState("cancelled");
      toast({ title: "Autopay setup cancelled", variant: "destructive" });
      cleanUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const start = async () => {
    setBusy(true);
    setCheckoutUrl(null);
    setReturnState("idle");
    try {
      const { url } = await startAutopaySetup();
      setCheckoutUrl(url);
      openCheckoutUrl(url);
    } catch (e) {
      toast({ title: "Setup failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const statusText = loading
    ? "Checking…"
    : returnState === "confirming"
      ? "Confirming card setup…"
      : pmId
        ? "A card is on file. Installments will charge automatically on their due date."
        : returnState === "needs_retry"
          ? "We couldn't confirm your card setup. Please try again."
          : returnState === "cancelled"
            ? "Setup was cancelled. You can try again anytime."
            : "No card on file. Add one to charge installments automatically.";

  const showWarning = !loading && !pmId && (returnState === "needs_retry" || returnState === "cancelled");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Autopay
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className={`text-sm flex items-center gap-2 ${showWarning ? "text-destructive" : "text-muted-foreground"}`}>
          {showWarning ? <AlertCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
          {statusText}
        </div>
        <div className="flex items-center gap-2">
          {checkoutUrl && (
            <Button asChild size="sm" variant="secondary">
              <a href={checkoutUrl} target="_top" rel="noopener noreferrer">
                Open Stripe checkout <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
          <Button size="sm" variant={pmId ? "outline" : "default"} onClick={start} disabled={busy || returnState === "confirming"}>
            {busy || returnState === "confirming"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : pmId
                ? "Replace card"
                : returnState === "needs_retry" || returnState === "cancelled"
                  ? "Try setup again"
                  : "Set up autopay"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
