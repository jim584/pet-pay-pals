import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getTicket, type VetTicket } from "@/lib/vet-tickets-api";
import { ArrowLeft, CreditCard, Clock, Lock, AlertTriangle } from "lucide-react";

function fmt(n: number | null | undefined) { return `$${Number(n ?? 0).toFixed(2)}`; }

function useCountdown(target: string | null) {
  const [left, setLeft] = useState<number>(target ? new Date(target).getTime() - Date.now() : 0);
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setLeft(new Date(target).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (left <= 0) return "Expired";
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function VetCardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<VetTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(ticket?.authorized_until ?? null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const t = await getTicket(id);
        if (!t || t.owner_id !== user?.id) {
          toast({ title: "Not found", variant: "destructive" });
          return;
        }
        setTicket(t);
      } finally { setLoading(false); }
    })();
  }, [id, user?.id]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!ticket) return <div className="p-6">Ticket not available.</div>;

  const cardReady = ticket.status === "card_issued";
  const isStub = ticket.card_id?.startsWith("stub_");
  const expired = ticket.authorized_until && new Date(ticket.authorized_until) < new Date();

  return (
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      <Link to="/dashboard/vet-tickets" className="text-sm text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{ticket.clinic_name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Approved {fmt(ticket.approved_amount)} • Locked to this clinic
              </p>
            </div>
            <Badge variant={cardReady && !expired ? "default" : "destructive"}>
              {ticket.status.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!cardReady && (
            <p className="text-sm text-muted-foreground">
              No active card for this ticket. Cards are issued automatically once a ticket is funded.
            </p>
          )}

          {cardReady && (
            <>
              <div className="rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <CreditCard className="h-6 w-6" />
                  <span className="text-xs uppercase tracking-wider opacity-80">
                    {isStub ? "Demo card" : "Help A Pet Vet Card"}
                  </span>
                </div>
                <p className="text-2xl font-mono tracking-widest mb-4">
                  •••• •••• •••• {isStub ? "0000" : "••••"}
                </p>
                <div className="flex justify-between text-xs">
                  <div>
                    <p className="opacity-70">Authorized for</p>
                    <p className="font-medium">{fmt(ticket.approved_amount)}</p>
                  </div>
                  <div>
                    <p className="opacity-70">Expires in</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />{countdown}
                    </p>
                  </div>
                </div>
              </div>

              {isStub && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600" />
                  <div>
                    Stripe Issuing isn't activated yet — this is a placeholder card. Once Issuing is approved on the Stripe account,
                    real card numbers will appear here automatically.
                  </div>
                </div>
              )}

              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4" /> Spending controls
                </div>
                <ul className="text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Capped at <strong>{fmt(ticket.approved_amount)}</strong> total</li>
                  <li>
                    {ticket.merchant_lock_type === "merchant_id"
                      ? `Locked to clinic ${ticket.clinic_name}`
                      : `Limited to veterinary services (MCC 0742)`}
                  </li>
                  <li>Window expires {ticket.authorized_until ? new Date(ticket.authorized_until).toLocaleString() : "—"}</li>
                </ul>
              </div>

              <div className="text-sm text-muted-foreground">
                Hand these card details to the clinic. They process it as a standard Visa transaction — no special software or onboarding required. The card automatically freezes after settlement or when the window closes.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
