import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { reconcileReferrerPayouts, type ReconcileRow, type ReconcileSummary } from "@/lib/referrals-api";

const fmt = (n: number | null) => n == null ? "—" : `$${Number(n).toFixed(2)}`;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString() : "—";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  matched: "default",
  missing_internal: "destructive",
  missing_stripe: "destructive",
  amount_mismatch: "destructive",
  status_mismatch: "secondary",
};

export default function ReferralReconcileTab() {
  const [days, setDays] = useState(90);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReconcileSummary | null>(null);
  const [rows, setRows] = useState<ReconcileRow[]>([]);

  const run = async () => {
    setLoading(true);
    try {
      const res = await reconcileReferrerPayouts(days);
      setSummary(res.summary);
      setRows(res.rows);
      toast.success(`Reconciled ${res.summary.stripe_transfer_count} Stripe transfers`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);
  const issues = summary ? summary.missing_internal + summary.missing_stripe + summary.amount_mismatch + summary.status_mismatch : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Window (days)</Label>
            <Input type="number" min={1} max={365} value={days} onChange={e => setDays(parseInt(e.target.value) || 90)} className="w-28" />
          </div>
          <div>
            <Label className="text-xs">Filter</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="missing_internal">Missing internal</SelectItem>
                <SelectItem value="missing_stripe">Missing Stripe</SelectItem>
                <SelectItem value="amount_mismatch">Amount mismatch</SelectItem>
                <SelectItem value="status_mismatch">Status mismatch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Run reconciliation
          </Button>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Stripe transfers" value={summary.stripe_transfer_count} sub={`Total ${fmt(summary.stripe_total)}`} />
          <Stat label="Internal payouts" value={summary.internal_payout_count} sub={`Total ${fmt(summary.internal_total)}`} />
          <Stat label="Matched" value={summary.matched} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} />
          <Stat label="Issues" value={issues} icon={issues ? <AlertTriangle className="h-4 w-4 text-destructive" /> : undefined} highlight={issues > 0} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Referrer</TableHead>
              <TableHead>Stripe transfer</TableHead>
              <TableHead>Internal payout</TableHead>
              <TableHead className="text-right">Stripe $</TableHead>
              <TableHead className="text-right">Internal $</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9}><Skeleton className="h-20" /></TableCell></TableRow>}
              {!loading && filtered.map((r, i) => {
                const delta = r.stripe_amount != null && r.internal_amount != null
                  ? r.stripe_amount - r.internal_amount : null;
                return (
                  <TableRow key={i}>
                    <TableCell><Badge variant={statusVariant[r.status] ?? "outline"}>{r.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-xs">{fmtDate(r.stripe_created ?? r.internal_paid_at)}</TableCell>
                    <TableCell className="text-xs">{r.referrer_name ?? r.referrer_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.stripe_transfer_id ? <span title={r.stripe_transfer_id}>{r.stripe_transfer_id.slice(0, 16)}…</span> : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.internal_payout_id ? r.internal_payout_id.slice(0, 8) + "…" : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.stripe_amount)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.internal_amount)}</TableCell>
                    <TableCell className={`text-right font-mono ${delta && Math.abs(delta) > 0.01 ? "text-destructive" : ""}`}>
                      {delta == null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.reversed && <Badge variant="outline" className="mr-1">reversed</Badge>}
                      {r.internal_status && r.internal_status !== "paid" && `internal: ${r.internal_status}`}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && summary && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No rows for this filter.</TableCell></TableRow>
              )}
              {!loading && !summary && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Click "Run reconciliation" to fetch Stripe transfers and compare.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, icon, highlight }: { label: string; value: number | string; sub?: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
