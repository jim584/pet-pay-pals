import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Loader2, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listMyObligations,
  listInstallments,
  startInstallmentCheckout,
  type MyObligation,
  type MyInstallment,
} from "@/lib/bnpl-api";

const fmt = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", active: "default", paid_off: "outline",
  defaulted: "destructive", cancelled: "outline",
};

const INSTALLMENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline", due: "default", paid: "secondary", missed: "destructive",
};

export default function PaymentPlansPage() {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [obligations, setObligations] = useState<MyObligation[]>([]);
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, MyInstallment[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setObligations([]); return; }
      const obs = await listMyObligations(user.id);
      setObligations(obs);
      const entries = await Promise.all(
        obs.map(async (o) => [o.id, await listInstallments(o.id)] as const),
      );
      setInstallmentsMap(Object.fromEntries(entries));
    } catch (e) {
      toast({ title: "Failed to load payment plans", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (params.get("paid")) {
      toast({ title: "Payment received", description: "Your installment was processed." });
      params.delete("paid"); setParams(params, { replace: true });
    } else if (params.get("cancelled")) {
      toast({ title: "Payment cancelled", description: "No charge was made.", variant: "destructive" });
      params.delete("cancelled"); setParams(params, { replace: true });
    }
    // eslint-disable-next-line
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return obligations;
    if (filter === "open") return obligations.filter((o) => ["pending", "active", "defaulted"].includes(o.status));
    return obligations.filter((o) => ["paid_off", "cancelled"].includes(o.status));
  }, [obligations, filter]);

  const pay = async (obligationId: string, installmentId?: string, payFull = false) => {
    setBusyId(installmentId ?? obligationId);
    try {
      const url = await startInstallmentCheckout({ obligation_id: obligationId, installment_id: installmentId, pay_full: payFull });
      window.location.href = url;
    } catch (e) {
      toast({ title: "Checkout failed", description: (e as Error).message, variant: "destructive" });
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-7 w-7" /> Payment Plans
        </h1>
        <p className="text-muted-foreground">
          Pay your vet-bill installments and track your active payment plans.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No payment plans here yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {filtered.map((o) => {
            const installments = installmentsMap[o.id] ?? [];
            const paid = Number(o.original_amount) - Number(o.outstanding_amount);
            const pct = o.original_amount > 0 ? Math.min(100, (paid / o.original_amount) * 100) : 0;
            const nextDue = installments.find((i) => i.status === "due") ?? installments.find((i) => i.status === "scheduled");
            const canPay = ["pending", "active", "defaulted"].includes(o.status) && o.outstanding_amount > 0;
            return (
              <Card key={o.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{o.clinic_name ?? "Vet bill"}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {fmtDate(o.created_at)} · {o.installment_count} installments × {o.installment_interval_days} days
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[o.status] ?? "outline"} className="capitalize">
                      {o.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Original</div>
                      <div className="font-semibold">{fmt(o.original_amount)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Paid</div>
                      <div className="font-semibold">{fmt(paid)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Outstanding</div>
                      <div className="font-semibold">{fmt(o.outstanding_amount)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Next due</div>
                      <div className="font-semibold">{fmtDate(nextDue?.due_date ?? o.next_due_date)}</div>
                    </div>
                  </div>

                  <Progress value={pct} />

                  {installments.length > 0 && (
                    <div className="rounded-lg border divide-y">
                      {installments.map((i) => {
                        const remaining = +(Number(i.amount) - Number(i.paid_amount ?? 0)).toFixed(2);
                        return (
                          <div key={i.id} className="p-3 flex flex-wrap items-center gap-3 justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                {i.seq}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium flex items-center gap-2">
                                  {fmt(i.amount)}
                                  <Badge variant={INSTALLMENT_VARIANT[i.status] ?? "outline"} className="capitalize text-[10px]">
                                    {i.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {fmtDate(i.due_date)}
                                </div>
                              </div>
                            </div>
                            {i.status === "paid" ? (
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Paid {fmtDate(i.paid_at)}
                              </span>
                            ) : canPay && remaining > 0 ? (
                              <Button
                                size="sm"
                                onClick={() => pay(o.id, i.id)}
                                disabled={busyId === i.id}
                              >
                                {busyId === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${fmt(remaining)}`}
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {o.status === "defaulted" && (
                    <div className="text-sm rounded-md border border-destructive/40 bg-destructive/5 text-destructive p-3 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5" />
                      <div>
                        This plan has been marked as defaulted because of missed installments.
                        Please pay the outstanding balance to bring it current.
                      </div>
                    </div>
                  )}

                  {canPay && (
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => pay(o.id, undefined, true)}
                        disabled={busyId === o.id}
                      >
                        {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Pay full balance ({fmt(o.outstanding_amount)})
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
