import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { triggerStripeBackfill } from "@/lib/admin-api";
import {
  CreditCard, DollarSign, RefreshCw, ExternalLink, Loader2, FileText, TrendingUp,
  ChevronDown, ChevronRight,
} from "lucide-react";

type Installment = {
  id: string; obligation_id: string; amount: number; paid_at: string;
  method: string; external_ref: string | null; notes: string | null;
};
type Obligation = {
  id: string; ticket_id: string | null; provider: string;
  original_amount: number; outstanding_amount: number; status: string;
  external_ref: string | null; created_at: string;
};
type PaymentRow = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  kind: string;
  description: string | null;
  occurred_at: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  vet_ticket_id: string | null;
  bnpl_obligation_id: string | null;
  user_full_name?: string | null;
  obligation?: Obligation | null;
  installments?: Installment[];
  ticket_clinic_name?: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  succeeded: "default",
  refunded: "secondary",
  failed: "destructive",
  pending: "outline",
};

const KIND_LABEL: Record<string, string> = {
  membership_invoice: "Membership",
  member_remainder: "Member remainder",
  donation: "Donation",
  one_time: "One-time",
};

const fmt = (n: number, cur = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: (cur || "usd").toUpperCase() }).format(Number(n ?? 0));

export default function AdminPaymentsPage() {
  const PAGE_SIZE = 50;
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [rangeDays, setRangeDays] = useState<string>("30");
  const [syncing, setSyncing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const reqIdRef = useRef(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const fetchPage = useCallback(async (offset: number, reqId: number) => {
    let q = supabase
      .from("payment_history")
      .select("*", { count: offset === 0 ? "exact" : undefined })
      .order("occurred_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (rangeDays !== "all") {
      const since = new Date(Date.now() - Number(rangeDays) * 86400000).toISOString();
      q = q.gte("occurred_at", since);
    }
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (kindFilter !== "all") q = q.eq("kind", kindFilter);
    const { data, error, count } = await q;
    if (error) throw error;
    if (reqId !== reqIdRef.current) return null;

    const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)));
    const profileMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id, full_name").in("user_id", userIds);
      (profs ?? []).forEach((p: any) => profileMap.set(p.user_id, p.full_name));
    }

    // Linked vet tickets + obligations + installments
    const ticketIds = Array.from(new Set((data ?? [])
      .map((r: any) => r.vet_ticket_id).filter(Boolean)));
    const directObIds = Array.from(new Set((data ?? [])
      .map((r: any) => r.bnpl_obligation_id).filter(Boolean)));

    const [ticketsRes, obByTicketRes, obDirectRes] = await Promise.all([
      ticketIds.length
        ? supabase.from("vet_tickets").select("id, clinic_name").in("id", ticketIds)
        : Promise.resolve({ data: [] } as any),
      ticketIds.length
        ? supabase.from("bnpl_obligations")
            .select("id, ticket_id, provider, original_amount, outstanding_amount, status, external_ref, created_at")
            .in("ticket_id", ticketIds)
        : Promise.resolve({ data: [] } as any),
      directObIds.length
        ? supabase.from("bnpl_obligations")
            .select("id, ticket_id, provider, original_amount, outstanding_amount, status, external_ref, created_at")
            .in("id", directObIds)
        : Promise.resolve({ data: [] } as any),
    ]);

    const ticketMap = new Map<string, any>((ticketsRes.data ?? []).map((t: any) => [t.id, t]));
    const obByTicket = new Map<string, Obligation>(
      (obByTicketRes.data ?? []).map((o: any) => [o.ticket_id, o as Obligation])
    );
    const obById = new Map<string, Obligation>([
      ...((obByTicketRes.data ?? []) as Obligation[]),
      ...((obDirectRes.data ?? []) as Obligation[]),
    ].map((o) => [o.id, o]));

    const allObIds = Array.from(new Set([
      ...directObIds,
      ...((obByTicketRes.data ?? []) as any[]).map((o) => o.id),
    ]));
    const installMap = new Map<string, Installment[]>();
    if (allObIds.length) {
      const { data: pays } = await supabase
        .from("bnpl_payments")
        .select("id, obligation_id, amount, paid_at, method, external_ref, notes")
        .in("obligation_id", allObIds)
        .order("paid_at", { ascending: false });
      (pays ?? []).forEach((p: any) => {
        const arr = installMap.get(p.obligation_id) ?? [];
        arr.push(p as Installment);
        installMap.set(p.obligation_id, arr);
      });
    }

    const mapped = ((data ?? []) as any[]).map((r) => {
      const directOb = r.bnpl_obligation_id ? obById.get(r.bnpl_obligation_id) ?? null : null;
      const ticketOb = r.vet_ticket_id ? obByTicket.get(r.vet_ticket_id) ?? null : null;
      const obligation = directOb ?? ticketOb ?? null;
      return {
        ...r,
        user_full_name: profileMap.get(r.user_id) ?? null,
        ticket_clinic_name: r.vet_ticket_id ? (ticketMap.get(r.vet_ticket_id)?.clinic_name ?? null) : null,
        obligation,
        installments: obligation ? (installMap.get(obligation.id) ?? []) : [],
      };
    }) as PaymentRow[];
    return { mapped, count: count ?? null, gotFull: (data?.length ?? 0) === PAGE_SIZE };
  }, [rangeDays, statusFilter, kindFilter]);

  const loadFirst = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true); setHasMore(true);
    try {
      const res = await fetchPage(0, reqId);
      if (!res) return;
      setRows(res.mapped);
      setTotalCount(res.count);
      setHasMore(res.gotFull);
    } catch (e: any) {
      toast({ title: "Failed to load payments", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    const reqId = reqIdRef.current;
    try {
      const res = await fetchPage(rows.length, reqId);
      if (!res) return;
      setRows((prev) => [...prev, ...res.mapped]);
      setHasMore(res.gotFull);
    } catch (e: any) {
      toast({ title: "Failed to load more", description: e.message, variant: "destructive" });
    } finally { setLoadingMore(false); }
  }, [fetchPage, rows.length, loadingMore, loading, hasMore]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.user_full_name ?? "").toLowerCase().includes(s) ||
      (r.description ?? "").toLowerCase().includes(s) ||
      (r.stripe_invoice_id ?? "").toLowerCase().includes(s) ||
      (r.stripe_payment_intent_id ?? "").toLowerCase().includes(s)
    );
  }, [rows, search]);

  const kpis = useMemo(() => {
    const paid = filtered.filter((r) => r.status === "paid" || r.status === "succeeded");
    const gross = paid.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const refunded = filtered
      .filter((r) => r.status === "refunded")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      gross, refunded, count: paid.length, failed: filtered.filter((r) => r.status === "failed").length,
    };
  }, [filtered]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await triggerStripeBackfill();
      toast({ title: "Synced from Stripe", description: `Synced ${res.synced} · Created ${res.created}` });
      await loadFirst();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Payments</h1>
          <p className="text-sm text-muted-foreground">All collected revenue, refunds, and failed charges.</p>
        </div>
        <Button onClick={sync} disabled={syncing} variant="outline">
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync from Stripe
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gross collected" value={fmt(kpis.gross)} icon={DollarSign} accent="text-primary" />
        <KpiCard label="Successful payments" value={String(kpis.count)} icon={CreditCard} accent="text-accent" />
        <KpiCard label="Refunded" value={fmt(kpis.refunded)} icon={TrendingUp} accent="text-muted-foreground" />
        <KpiCard label="Failed" value={String(kpis.failed)} icon={FileText} accent="text-destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search by name, description, or Stripe ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Kind" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                <SelectItem value="membership_invoice">Membership</SelectItem>
                <SelectItem value="member_remainder">Member remainder</SelectItem>
                <SelectItem value="donation">Donation</SelectItem>
                <SelectItem value="one_time">One-time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!loading && filtered.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              No payments match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`s-${i}`} />)
                    : filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.occurred_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.user_full_name || <span className="text-muted-foreground">{r.user_id.slice(0, 8)}…</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={r.description ?? ""}>
                        {r.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.amount, r.currency)}</TableCell>
                      <TableCell className="text-right">
                        {r.hosted_invoice_url ? (
                          <Button asChild variant="ghost" size="sm">
                            <a href={r.hosted_invoice_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : r.invoice_pdf ? (
                          <Button asChild variant="ghost" size="sm">
                            <a href={r.invoice_pdf} target="_blank" rel="noreferrer">
                              <FileText className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && loadingMore && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={`m-${i}`} />)}
                </TableBody>
              </Table>
              <div ref={sentinelRef} className="h-1" />
              <div className="py-4 text-center text-xs text-muted-foreground">
                {loadingMore ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading more…</span>
                ) : hasMore ? (
                  <Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button>
                ) : (
                  <span>
                    Showing all {rows.length}
                    {totalCount !== null && totalCount !== rows.length ? ` of ${totalCount}` : ""} transactions
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${accent}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display">{value}</div>
      </CardContent>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-3 w-28" /></TableCell>
      <TableCell><Skeleton className="h-3 w-32" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-3 w-48" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-3 w-16 ml-auto" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-4 w-4 ml-auto" /></TableCell>
    </TableRow>
  );
}
