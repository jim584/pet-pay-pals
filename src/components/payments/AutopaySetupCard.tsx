import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAutopayStatus, startAutopaySetup } from "@/lib/bnpl-api";

interface Props {
  /** Triggered after redirect-back when autopay just completed setup, so parent can reload. */
  onSetupComplete?: () => void;
}

export function AutopaySetupCard({ onSetupComplete }: Props) {
  const { user } = useAuth();
  const [pmId, setPmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
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
    if (handledReturn.current) return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get("autopay");
    if (status === "success") {
      handledReturn.current = true;
      toast({ title: "Autopay enabled", description: "Your card has been saved for installments." });
      // Webhook may arrive shortly after redirect. Poll a few times.
      setConfirming(true);
      let tries = 0;
      const poll = async () => {
        tries++;
        await refresh();
        const { data } = await fetch("about:blank").then(() => ({ data: null })).catch(() => ({ data: null }));
        // re-read fresh status
        if (user) {
          const s = await getAutopayStatus(user.id).catch(() => null);
          if (s?.default_payment_method_id) {
            setPmId(s.default_payment_method_id);
            setConfirming(false);
            onSetupComplete?.();
            return;
          }
        }
        if (tries < 6) setTimeout(poll, 1500);
        else setConfirming(false);
      };
      setTimeout(poll, 1000);
      url.searchParams.delete("autopay");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } else if (status === "cancelled") {
      handledReturn.current = true;
      toast({ title: "Autopay setup cancelled", variant: "destructive" });
      url.searchParams.delete("autopay");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const start = async () => {
    setBusy(true);
    setCheckoutUrl(null);
    try {
      const { url } = await startAutopaySetup();
      setCheckoutUrl(url);
      // Try to redirect. In sandboxed preview iframes this may be blocked silently;
      // in that case the user can click the visible fallback link below.
      try {
        window.open(url, "_top") ?? (window.location.href = url);
      } catch {
        window.location.href = url;
      }
      // Reset busy after a short delay so the fallback link is interactable.
      setTimeout(() => setBusy(false), 1200);
    } catch (e) {
      toast({ title: "Setup failed", description: (e as Error).message, variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Autopay
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {loading
            ? "Checking…"
            : confirming
              ? "Confirming card setup…"
              : pmId
                ? "A card is on file. Installments will charge automatically on their due date."
                : "No card on file. Add one to charge installments automatically."}
        </div>
        <div className="flex items-center gap-2">
          {checkoutUrl && (
            <Button asChild size="sm" variant="secondary">
              <a href={checkoutUrl} target="_top" rel="noopener noreferrer">
                Continue <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
          <Button size="sm" variant={pmId ? "outline" : "default"} onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : pmId ? "Replace card" : "Set up autopay"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
