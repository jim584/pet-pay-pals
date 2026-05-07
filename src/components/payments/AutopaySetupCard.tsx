import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAutopayStatus, startAutopaySetup } from "@/lib/bnpl-api";

interface Props {
  /** Triggered after redirect-back when autopay just completed setup, so parent can reload. */
  onSetupComplete?: () => void;
}

export function AutopaySetupCard({ onSetupComplete }: Props) {
  const [pmId, setPmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
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
    const url = new URL(window.location.href);
    if (url.searchParams.get("autopay") === "success") {
      toast({ title: "Autopay enabled", description: "Your card has been saved for installments." });
      onSetupComplete?.();
    } else if (url.searchParams.get("autopay") === "cancelled") {
      toast({ title: "Autopay setup cancelled", variant: "destructive" });
    }
    // eslint-disable-next-line
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const { url } = await startAutopaySetup();
      window.location.href = url;
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
            : pmId
              ? "A card is on file. Installments will charge automatically on their due date."
              : "No card on file. Add one to charge installments automatically."}
        </div>
        <Button size="sm" variant={pmId ? "outline" : "default"} onClick={start} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : pmId ? "Replace card" : "Set up autopay"}
        </Button>
      </CardContent>
    </Card>
  );
}
