import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Search, DollarSign, CreditCard, AlertCircle, CheckCircle2, Pencil, History, Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchAdminBnpl, fetchAdminBnplStats, updateAdminBnpl,
  recordBnplPayment, fetchBnplPayments, deleteBnplPayment,
  type AdminBnplRow, type BnplFilter, type BnplStatus, type BnplStats, type BnplPaymentRow,
} from "@/lib/admin-api";

const FILTERS: { value: BnplFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "paid_off", label: "Paid off" },
  { value: "defaulted", label: "Defaulted" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  active: "default",
  paid_off: "outline",
  defaulted: "destructive",
  cancelled: "outline",
};

const STATUS_OPTIONS: BnplStatus[] = ["pending", "active", "paid_off", "defaulted", "cancelled"];
const fmtMoney = (n: number) => `$${Number(n).toFixed(2)}`;

export default function AdminPaymentPlansPage() {
  const [filter, setFilter] = useState<BnplFilter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminBnplRow[]>([]);
  const [stats, setStats] = useState<BnplStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<AdminBnplRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [historyTarget, setHistoryTarget] = useState<AdminBnplRow | null>(null);
  const [historyRows, setHistoryRows] = useState<BnplPaymentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminBnplRow | null>(null);
  const [editStatus, setEditStatus] = useState<BnplStatus>("active");
  const [editOutstanding, setEditOutstanding] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editRef, setEditRef] = useState("");

  const [defaultTarget, setDefaultTarget] = useState<AdminBnplRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminBnplRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([fetchAdminBnpl(filter, search), fetchAdminBnplStats()]);
      setRows(data);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Failed to load plans", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openHistory = async (row: AdminBnplRow) => {
    setHistoryTarget(row);
    setHistoryLoading(true);
    try {
      setHistoryRows(await fetchBnplPayments(row.id));
    } catch (e: any) {
      toast({ title: "Failed to load history", description: e.message, variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshHistory = async (id: string) => {
    try { setHistoryRows(await fetchBnplPayments(id)); } catch { /* noop */ }
  };

  const openEdit = (row: AdminBnplRow) => {
    setEditTarget(row);
    setEditStatus(row.status);
    setEditOutstanding(String(row.outstanding_amount));
    setEditProvider(row.provider);
    setEditRef(row.external_ref ?? "");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const out = Number(editOutstanding);
    if (Number.isNaN(out) || out < 0) {
      toast({ title: "Invalid outstanding amount", variant: "destructive" });
      return;
    }
    setBusyId(editTarget.id);
    try {
      await updateAdminBnpl(editTarget.id, {
        status: editStatus,
        outstanding_amount: out,
        provider: editProvider.trim() || "manual",
        external_ref: editRef.trim() || null,
      });
      toast({ title: "Plan updated" });
      setEditTarget(null);
      await load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const submitPayment = async () => {
    if (!paymentTarget) return;
    const amt = Number(paymentAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setBusyId(paymentTarget.id);
    try {
      await recordBnplPayment(paymentTarget.id, {
        amount: amt,
        method: paymentMethod || "manual",
        external_ref: paymentRef.trim() || null,
        notes: paymentNotes.trim() || null,
      });
      toast({ title: "Payment recorded" });
      setPaymentTarget(null);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
      setPaymentMethod("manual");
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const removePayment = async (paymentId: string, obligationId: string) => {
    try {
      await deleteBnplPayment(paymentId);
      toast({ title: "Payment removed" });
      await refreshHistory(obligationId);
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const markStatus = async (row: AdminBnplRow, status: BnplStatus) => {
    setBusyId(row.id);
    try {
      await updateAdminBnpl(row.id, { status });
      toast({ title: `Marked ${status}` });
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
      setDefaultTarget(null);
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Plans (BNPL)</h1>
        <p className="text-muted-foreground">Review obligations, record payments, and manage agreement statuses.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Total plans" value={stats?.total_plans ?? "—"} />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Outstanding" value={stats ? fmtMoney(stats.outstanding_total) : "—"} />
        <StatCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Defaulted" value={stats?.defaulted_count ?? "—"} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Paid off" value={stats?.paid_off_count ?? "—"} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as BnplFilter)}>
              <TabsList className="flex-wrap h-auto">
                {FILTERS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search owner, pet, clinic, ref"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No payment plans found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const paid = Math.max(0, row.original_amount - row.outstanding_amount);
                const pct = row.original_amount > 0 ? Math.min(100, (paid / row.original_amount) * 100) : 0;
                return (
                  <div key={row.id} className="flex flex-col gap-3 p-4 rounded-lg border bg-card">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={row.owner_avatar_url ?? undefined} />
                          <AvatarFallback>{(row.owner_full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{row.owner_full_name ?? "Unknown owner"}</p>
                            <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>{row.status}</Badge>
                            <Badge variant="outline" className="text-xs">{row.provider}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {row.pet_name ?? "Pet"} · {row.ticket_clinic_name ?? "Clinic"}
                            {row.external_ref ? ` · Ref ${row.external_ref}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created {new Date(row.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-sm font-semibold">{fmtMoney(row.outstanding_amount)} outstanding</div>
                        <div className="text-xs text-muted-foreground">
                          of {fmtMoney(row.original_amount)} · {fmtMoney(paid)} paid
                        </div>
                      </div>
                    </div>

                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => setPaymentTarget(row)}
                        disabled={row.outstanding_amount <= 0 || busyId === row.id}
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Record payment
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openHistory(row)} disabled={busyId === row.id}>
                        <History className="h-4 w-4 mr-1" /> History
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)} disabled={busyId === row.id}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      {row.status !== "defaulted" && row.status !== "paid_off" && (
                        <Button size="sm" variant="outline" onClick={() => setDefaultTarget(row)} disabled={busyId === row.id}>
                          Mark defaulted
                        </Button>
                      )}
                      {row.status !== "cancelled" && row.status !== "paid_off" && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelTarget(row)} disabled={busyId === row.id}>
                          Cancel plan
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/admin/vet-tickets">View tickets</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record payment dialog */}
      <Dialog open={!!paymentTarget} onOpenChange={(o) => !o && setPaymentTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {paymentTarget && (
                <>Outstanding: <strong>{fmtMoney(paymentTarget.outstanding_amount)}</strong> for {paymentTarget.owner_full_name ?? "owner"}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="amt">Amount (USD)</Label>
              <Input id="amt" type="number" step="0.01" min="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="method">Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ref">External reference (optional)</Label>
              <Input id="ref" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="txn id, check #, etc." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" rows={3} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentTarget(null)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={busyId === paymentTarget?.id}>
              {busyId === paymentTarget?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment history</DialogTitle>
            <DialogDescription>
              {historyTarget && <>Plan for {historyTarget.owner_full_name ?? "owner"} · {historyTarget.pet_name ?? "pet"}</>}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : historyRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {historyRows.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{fmtMoney(p.amount)}</span>
                      <Badge variant="outline" className="text-xs">{p.method}</Badge>
                      {p.external_ref && <span className="text-xs text-muted-foreground">Ref {p.external_ref}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleString()}</p>
                    {p.notes && <p className="text-sm mt-1">{p.notes}</p>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removePayment(p.id, p.obligation_id)}
                    title="Delete payment"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit payment plan</DialogTitle>
            <DialogDescription>Adjust status, outstanding balance, or provider details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as BnplStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Outstanding amount (USD)</Label>
              <Input type="number" step="0.01" min="0" value={editOutstanding} onChange={(e) => setEditOutstanding(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Provider</Label>
              <Input value={editProvider} onChange={(e) => setEditProvider(e.target.value)} placeholder="manual" />
            </div>
            <div className="space-y-1">
              <Label>External reference</Label>
              <Input value={editRef} onChange={(e) => setEditRef(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busyId === editTarget?.id}>
              {busyId === editTarget?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!defaultTarget} onOpenChange={(o) => !o && setDefaultTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as defaulted?</AlertDialogTitle>
            <AlertDialogDescription>
              The plan for {defaultTarget?.owner_full_name} will be flagged as defaulted. Outstanding balance will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => defaultTarget && markStatus(defaultTarget, "defaulted")}>
              Mark defaulted
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this payment plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets status to "cancelled". Use only when the obligation is voided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelTarget && markStatus(cancelTarget, "cancelled")}>
              Cancel plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
