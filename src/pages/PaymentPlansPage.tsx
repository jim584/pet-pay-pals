import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Loader2, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AutopaySetupCard } from "@/components/payments/AutopaySetupCard";
import {
  listMyObligations,
  listInstallments,
  startInstallmentCheckout,
  setObligationAutopay,
  type MyObligation,
  type MyInstallment,
} from "@/lib/bnpl-api";
import { openCheckoutUrl } from "@/lib/open-checkout";

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
  const { user, role, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [obligations, setObligations] = useState<MyObligation[]>([]);
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, MyInstallment[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const autopayRef = useRef<HTMLDivElement | null>(null);

  const triggerAutopaySetup = () => {
    autopayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const btn = autopayRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
      btn?.click();
    }, 350);
  };

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    // Hard timeout safety net so we never get stuck on a skeleton.
    const timeout = setTimeout(() => {
      setLoading((cur) => {
        if (cur) setLoadError("Loading is taking longer than expected. Please retry.");
        return false;
      });
    }, 15000);
    try {
      const obs = await listMyObligations(user.id);
      setObligations(obs);
      if (obs.length === 0) {
        setInstallmentsMap({});
      } else {
        const results = await Promise.allSettled(obs.map((o) => listInstallments(o.id)));
        const map: Record<string, MyInstallment[]> = {};
        results.forEach((r, i) => { map[obs[i].id] = r.status === "fulfilled" ? r.value : []; });
        setInstallmentsMap(map);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      toast({ title: "Failed to load payment plans", description: msg, variant: "destructive" });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    load();
    /* eslint-disable-next-line */
  }, [authLoading, user?.id]);

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
      openCheckoutUrl(url);
    } catch (e) {
      toast({ title: "Checkout failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (role && role !== "pet_owner") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Payment Plans are only available to pet owner accounts.
        </CardContent>
      </Card>
    );
  }

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

      <div ref={autopayRef} id="autopay-setup">
        <AutopaySetupCard onSetupComplete={load} />
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
      ) : loadError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <div className="text-sm text-destructive">{loadError}</div>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </CardContent>
        </Card>
      ) : obligations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <CreditCard className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No payment plans yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                When a vet visit is partially covered by your plan, the remainder is split into
                interest-free installments and shown here. Set up autopay so future
                installments charge automatically.
              </p>
            </div>
            <ol className="text-sm text-left max-w-md mx-auto space-y-2 pt-2">
              {[
                'Click "Set up autopay" to securely save a card via Stripe.',
                "After a vet visit, any uncovered balance is split into interest-free installments.",
                "Each installment is charged automatically and appears here under Open.",
                "Paid installments move to Closed; you can pay early or toggle autopay anytime.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <Button onClick={triggerAutopaySetup} className="mt-2">
              <CreditCard className="h-4 w-4 mr-2" />
              Set up autopay
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <CreditCard className="h-10 w-10 mx-auto opacity-50" />
            <div>No {filter} payment plans.</div>
            <Button variant="link" size="sm" onClick={() => setFilter("all")}>View all</Button>
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
            const isPaused = !!o.paused;
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
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[o.status] ?? "outline"} className="capitalize">
                        {o.status.replace("_", " ")}
                      </Badge>
                      {isPaused && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Paused — membership inactive
                        </Badge>
                      )}
                      {canPay && !isPaused && nextDue && (
                        <Button
                          size="sm"
                          onClick={() => pay(o.id, nextDue.id)}
                          disabled={busyId === nextDue.id}
                        >
                          {busyId === nextDue.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>Pay next due ({fmt(Math.max(0, Number(nextDue.amount) - Number(nextDue.paid_amount ?? 0)))})</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isPaused && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Auto-charges are paused while your Help A Pet membership isn't active.
                      Installments will resume automatically once your membership is reactivated.
                      You can still pay manually at any time.
                    </p>
                  )}
                  {canPay && (
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        id={`autopay-${o.id}`}
                        checked={o.auto_pay_enabled !== false}
                        onCheckedChange={async (v) => {
                          try {
                            await setObligationAutopay(o.id, v);
                            setObligations((prev) => prev.map((x) => x.id === o.id ? { ...x, auto_pay_enabled: v } : x));
                          } catch (e) {
                            toast({ title: "Failed to update", description: (e as Error).message, variant: "destructive" });
                          }
                        }}
                      />
                      <Label htmlFor={`autopay-${o.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        Auto-charge installments on their due date
                      </Label>
                    </div>
                  )}
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
