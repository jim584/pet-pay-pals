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

  useEffect(() => {
    (async () => {
      try {
        const [k, s, p] = await Promise.all([
          fetchAdminKpis(),
          fetchRecentSignups(6),
          fetchRecentPayments(6),
        ]);
        setKpis(k);
        setSignups(s);
        setPayments(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    { label: "Total users", value: kpis?.totalUsers ?? 0, icon: Users },
    { label: "Pet owners", value: kpis?.petOwners ?? 0, icon: UserPlus },
    { label: "Vets", value: kpis?.vets ?? 0, icon: Stethoscope },
    { label: "Pets", value: kpis?.totalPets ?? 0, icon: PawPrint },
    { label: "Active memberships", value: kpis?.activeMemberships ?? 0, icon: Shield },
    { label: "Pending vet tickets", value: kpis?.pendingTickets ?? 0, icon: FileCheck },
    { label: "Signups (7d)", value: kpis?.newSignups7d ?? 0, icon: TrendingUp },
    { label: "Revenue (30d)", value: kpis ? fmtMoney(kpis.revenue30d) : "$0.00", icon: DollarSign },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform health at a glance.</p>
      </div>

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
