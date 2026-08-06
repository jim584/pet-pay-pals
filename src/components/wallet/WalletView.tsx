import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet as WalletIcon, ArrowDownRight, ArrowUpRight, CreditCard, Shield, Clock, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { fetchWallet, fetchTransactions, Wallet, WalletTransaction } from "@/lib/community-api";
import { fetchMyMembership, fetchMyDpSummary, openCustomerPortal, fetchPaymentHistory, fetchMyReserveSummary, PaymentHistoryRow, ReserveSummary } from "@/lib/plans-api";
import { toast } from "@/hooks/use-toast";

export function WalletView() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [membership, setMembership] = useState<any>(null);
  const [dpSummary, setDpSummary] = useState<{ available: number; expiringSoon: number }>({ available: 0, expiringSoon: 0 });
  const [payments, setPayments] = useState<PaymentHistoryRow[]>([]);
  const [reserve, setReserve] = useState<ReserveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const url = await openCustomerPortal();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Couldn't open portal", description: e.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchWallet(user.id).then(async (w) => {
        setWallet(w);
        if (w) setTransactions(await fetchTransactions(w.id));
      }),
      fetchMyMembership(user.id).then(setMembership).catch(() => {}),
      fetchMyDpSummary(user.id).then(setDpSummary).catch(() => {}),
      fetchPaymentHistory(user.id).then(setPayments).catch(() => {}),
      fetchMyReserveSummary(user.id).then(setReserve).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="animate-pulse text-muted-foreground">Loading wallet...</div>;
  if (!wallet) return <p className="text-muted-foreground">No wallet found.</p>;

  const totalBalance = Number(wallet.wallet_balance) + Number(wallet.direct_pay_balance);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-display">My Wallet</h1>
          <p className="text-muted-foreground mt-1">Manage your funds and track transactions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/dashboard/vet-tickets">Vet tickets</Link></Button>
          {!membership && (
            <Button asChild><Link to="/plans">Choose a plan</Link></Button>
          )}
        </div>
      </div>

      {membership && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {membership.plan?.tier_label} <span className="text-sm font-normal text-muted-foreground capitalize">({membership.plan?.species})</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                Status: {membership.status} · Billing: {membership.billing_interval}ly
                {membership.is_fear_free_member && " · Fear Free"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Cap: {membership.plan?.plan_cap ? `$${Number(membership.plan.plan_cap).toLocaleString()}` : "Unlimited"}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? "Opening..." : "Manage subscription"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Direct Pay Available</p>
                <p className="text-2xl font-bold font-display">${dpSummary.available.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Expiring within 60 days</p>
                <p className="text-2xl font-bold font-display">${dpSummary.expiringSoon.toFixed(2)}</p>
              </div>
            </div>
            {dpSummary.byPet && dpSummary.byPet.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Balance by pet</p>
                <div className="rounded-lg border divide-y">
                  {dpSummary.byPet.map((p) => (
                    <div key={p.pet_id ?? "unassigned"} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">{p.petName}</span>
                      <span className="flex items-center gap-3">
                        {p.held > 0 && (
                          <span className="text-xs text-muted-foreground">${p.held.toFixed(2)} on hold</span>
                        )}
                        <span className="font-semibold">${p.available.toFixed(2)}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Direct Pay accrues to the specific pet its membership covers and can only be used for that pet.
                </p>
              </div>
            )}
          </CardContent>

        </Card>
      )}

      {membership && reserve && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Community Reserve Pool
            </CardTitle>
            <div className="flex items-center gap-2">
              {reserve.eligible
                ? <Badge>Eligible</Badge>
                : <Badge variant="outline">Locked</Badge>}
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard/wallet/reserve-history">My usage</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Access status</p>
                <p className="text-2xl font-bold font-display">
                  {reserve.eligible ? "Eligible" : "Locked"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Drawn for your tickets (lifetime)</p>
                <p className="text-2xl font-bold font-display">${reserve.lifetimeConsumed.toFixed(2)}</p>
              </div>
            </div>
            {!reserve.eligible && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {reserve.continuousPaidMonths} / 12 paid months
                  </span>
                  <span className="text-muted-foreground">
                    {reserve.monthsUntilEligible} month{reserve.monthsUntilEligible === 1 ? "" : "s"} to go
                  </span>
                </div>
                <Progress value={(reserve.continuousPaidMonths / 12) * 100} />
                <p className="text-xs text-muted-foreground">
                  Reserve access unlocks after 12 consecutive months of paid membership. Cancellations or
                  unpaid invoices reset the counter.
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              The Reserve is a <strong>shared community safety net</strong> funded by member contributions —
              not a personal balance. Access is discretionary and only kicks in <strong>after</strong> Direct
              Pay and BNPL on eligible tickets, while pool funds are available.
            </p>

          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            <WalletIcon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">${totalBalance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
            <ArrowDownRight className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">${Number(wallet.wallet_balance).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Withdrawable funds</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Direct Pay</CardTitle>
            <CreditCard className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">${Number(wallet.direct_pay_balance).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Vet payments only</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      tx.type === "donation_received" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                    }`}>
                      {tx.type === "donation_received" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{tx.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.type === "donation_received" ? "text-accent" : "text-destructive"}`}>
                      {tx.type === "donation_received" ? "+" : "-"}${Number(tx.amount).toFixed(2)}
                    </p>
                    <div className="flex gap-1 justify-end">
                      {Number(tx.wallet_portion) > 0 && <Badge variant="secondary" className="text-[10px]">W: ${Number(tx.wallet_portion).toFixed(2)}</Badge>}
                      {Number(tx.direct_pay_portion) > 0 && <Badge variant="outline" className="text-[10px]">DP: ${Number(tx.direct_pay_portion).toFixed(2)}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Membership Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No membership payments yet.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      p.status === "paid" ? "bg-accent/10 text-accent"
                      : p.status === "refunded" ? "bg-muted text-muted-foreground"
                      : "bg-destructive/10 text-destructive"
                    }`}>
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.description || p.kind.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.occurred_at).toLocaleDateString()} · <span className="capitalize">{p.status}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${p.status === "refunded" ? "text-muted-foreground" : ""}`}>
                      {p.status === "refunded" ? "-" : ""}${Number(p.amount).toFixed(2)}
                    </p>
                    {p.hosted_invoice_url && (
                      <a href={p.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline">
                        View invoice
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
