import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchMyReserveHistory, type ReserveConsumptionRow,
} from "@/lib/reserve-history-api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

export default function ReserveHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReserveConsumptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchMyReserveHistory(user.id)
      .then(setRows)
      .catch((e) => toast({ title: "Couldn't load reserve history", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const totalConsumed = rows.filter((r) => !r.released).reduce((s, r) => s + r.amount_consumed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/dashboard/wallet"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Wallet</Link>
          </Button>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Community Reserve Pool — My Usage
          </h1>
          <p className="text-muted-foreground mt-1">
            Times the shared community pool covered part of one of your vet tickets.
          </p>
        </div>
        <Card className="min-w-[180px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total drawn for you</p>
            <p className="text-2xl font-bold font-display">{fmt(totalConsumed)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Consumptions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Your Reserve hasn't been used yet. It will appear here once you opt in on a ticket and it's drawn from.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ticket_id.slice(0, 8)}…</TableCell>
                      <TableCell>{r.clinic_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.amount_consumed)}</TableCell>
                      <TableCell>
                        {r.released
                          ? <Badge variant="outline">Refunded</Badge>
                          : <Badge>Consumed</Badge>}
                      </TableCell>
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
