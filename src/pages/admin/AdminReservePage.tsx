import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Wallet, Clock, TrendingUp, ShieldCheck, RefreshCw, Loader2, PlayCircle,
} from "lucide-react";
import {
  fetchReserveKpis, fetchAdminAccruals, fetchAdminDpExpiryLedger, runDpExpiryJob,
  fetchAdminReserveAccruals, fetchAdminReserveConsumptions,
  type ReserveKpis, type AdminAccrualRow, type AdminDpLedgerRow,
  type AdminReserveAccrualRow, type AdminReserveConsumptionRow,
} from "@/lib/admin-api";
import { Input } from "@/components/ui/input";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export default function AdminReservePage() {
  const [kpis, setKpis] = useState<ReserveKpis | null>(null);
  const [accruals, setAccruals] = useState<AdminAccrualRow[]>([]);
  const [ledger, setLedger] = useState<AdminDpLedgerRow[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      const [k, a, l] = await Promise.all([
        fetchReserveKpis(),
        fetchAdminAccruals(filter),
        fetchAdminDpExpiryLedger(),
      ]);
      setKpis(k);
      setAccruals(a);
      setLedger(l);
    } catch (e: any) {
      toast({ title: "Failed to load reserve data", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleRefresh = () => { setRefreshing(true); load(); };

  const handleRunJob = async () => {
    setRunning(true);
    try {
      const res: any = await runDpExpiryJob();
      const processed = res?.processed ?? 0;
      const added = Number(res?.totalReserve ?? res?.reserve_added ?? 0);
      toast({
        title: "DP expiry job complete",
        description: `Processed ${processed} accrual(s) · ${fmt(added)} added to reserve`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Job failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const expiresBadge = (iso: string | null, expired: boolean) => {
    if (expired) return <Badge variant="secondary">Expired</Badge>;
    if (!iso) return <span className="text-muted-foreground">—</span>;
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return <Badge variant="destructive">Past due</Badge>;
    if (days <= 60) return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">in {days}d</Badge>;
    return <span className="text-sm text-muted-foreground">{fmtDate(iso)}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold font-display">Wallet & Reserve</h1>
          <p className="text-muted-foreground mt-1">Direct Pay accruals, expiry redistribution, and the community reserve.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={handleRunJob} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Run DP expiry job
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Community Reserve</CardTitle>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-bold font-display">{fmt(kpis?.reserveBalance ?? 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Available pool</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active DP Outstanding</CardTitle>
            <Wallet className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-bold font-display">{fmt(kpis?.activeOutstanding ?? 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across all members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring ≤ 60d</CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-3xl font-bold font-display">{fmt(kpis?.expiringSoon ?? 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Will redistribute soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">DP Expired (lifetime)</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-3xl font-bold font-display">{fmt(kpis?.lifetimeExpired ?? 0)}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-[10px]">Reserve {fmt(kpis?.lifetimeReserveIn ?? 0)}</Badge>
                  <Badge variant="outline" className="text-[10px]">Help-Now {fmt(kpis?.lifetimeHelpNow ?? 0)}</Badge>
                  <Badge variant="outline" className="text-[10px]">Admin {fmt(kpis?.lifetimeAdmin ?? 0)}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accruals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-display">Direct Pay Accruals</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Latest 100 records.</p>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : accruals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No accruals to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Accrual month</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accruals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.user_full_name ?? <span className="text-muted-foreground">Unknown</span>}</TableCell>
                      <TableCell>{fmtMonth(a.accrual_month)}</TableCell>
                      <TableCell className="text-right">{fmt(a.amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(a.remaining_amount)}</TableCell>
                      <TableCell>{expiresBadge(a.expires_at, a.expired)}</TableCell>
                      <TableCell>
                        {a.expired
                          ? <Badge variant="secondary">Expired</Badge>
                          : a.remaining_amount > 0
                            ? <Badge>Active</Badge>
                            : <Badge variant="outline">Consumed</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">DP Expiry Ledger</CardTitle>
          <p className="text-xs text-muted-foreground">Each row records how an expired accrual was redistributed (50% Reserve · 30% Help-Now · 20% Admin).</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No expiry events yet. Run the job above when accruals reach their expiry window.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Expired</TableHead>
                    <TableHead className="text-right">→ Reserve</TableHead>
                    <TableHead className="text-right">→ Help-Now</TableHead>
                    <TableHead className="text-right">→ Admin</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{fmtDate(l.created_at)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(l.expired_amount)}</TableCell>
                      <TableCell className="text-right">{fmt(l.community_reserve_portion)}</TableCell>
                      <TableCell className="text-right">{fmt(l.help_now_portion)}</TableCell>
                      <TableCell className="text-right">{fmt(l.admin_portion)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{l.reason.replace(/_/g, " ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
