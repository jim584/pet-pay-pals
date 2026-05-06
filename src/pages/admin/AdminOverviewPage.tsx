import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, PawPrint, Shield, FileCheck, DollarSign, TrendingUp, Stethoscope, UserPlus, RefreshCw, Heart, Repeat } from "lucide-react";
import { fetchAdminKpis, fetchRecentSignups, fetchRecentPayments, triggerStripeBackfill, type AdminKpis } from "@/lib/admin-api";
import { toast } from "sonner";

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

export default function AdminOverviewPage() {
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const [k, s, p] = await Promise.all([
      fetchAdminKpis(),
      fetchRecentSignups(6),
      fetchRecentPayments(6),
    ]);
    setKpis(k);
    setSignups(s);
    setPayments(p);
  };

  useEffect(() => {
    (async () => {
      try { await load(); } finally { setLoading(false); }
    })();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerStripeBackfill();
      toast.success(`Stripe sync complete — ${res.created} new payment(s) imported (${res.synced} checked).`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const cards = [
    { label: "Total users", value: kpis?.totalUsers ?? 0, icon: Users },
    { label: "Pet owners", value: kpis?.petOwners ?? 0, icon: UserPlus },
    { label: "Vets", value: kpis?.vets ?? 0, icon: Stethoscope },
    { label: "Pets", value: kpis?.totalPets ?? 0, icon: PawPrint },
    { label: "Active memberships", value: kpis?.activeMemberships ?? 0, icon: Shield },
    { label: "Pending vet tickets", value: kpis?.pendingTickets ?? 0, icon: FileCheck },
    { label: "Signups (7d)", value: kpis?.newSignups7d ?? 0, icon: TrendingUp },
    { label: "MRR", value: kpis ? fmtMoney(kpis.mrr) : "$0.00", icon: Repeat },
    { label: "Recorded revenue (30d)", value: kpis ? fmtMoney(kpis.revenue30d) : "$0.00", icon: DollarSign },
    { label: "Donations (30d)", value: kpis ? fmtMoney(kpis.donations30d) : "$0.00", icon: Heart },
  ];

  const lastPaymentLabel = kpis?.lastPaymentAt
    ? new Date(kpis.lastPaymentAt).toLocaleString()
    : "Never — no Stripe invoices have been recorded yet.";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">Platform health at a glance.</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Stripe payments"}
        </Button>
      </div>

      {kpis && kpis.activeMemberships > 0 && !kpis.lastPaymentAt && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Stripe webhook may not be wired up</p>
            <p className="text-muted-foreground mt-1">
              You have {kpis.activeMemberships} active membership(s) but no invoices recorded in payment history.
              Click <strong>Sync Stripe payments</strong> above to backfill, and verify your webhook endpoint in Stripe
              points at <code>/functions/v1/stripe-webhook</code> with <code>STRIPE_WEBHOOK_SECRET</code> configured.
            </p>
            <p className="text-xs text-muted-foreground mt-2">Last recorded payment: {lastPaymentLabel}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {loading ? <span className="text-muted-foreground animate-pulse">…</span> : c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent signups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signups.length === 0 && (
              <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No signups yet."}</p>
            )}
            {signups.map((s) => (
              <div key={s.user_id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={s.avatar_url ?? undefined} />
                  <AvatarFallback>{(s.full_name?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 && (
              <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No payments recorded."}</p>
            )}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.kind?.replace(/_/g, " ") ?? "payment"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.occurred_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                    {p.status}
                  </Badge>
                  <span className="font-mono">{fmtMoney(Number(p.amount))}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
