import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Check, X, Pause, Play, Ban, Clock, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchAdminMemberships,
  adminMembershipAction,
  type AdminMembershipRow,
  type MembershipStatus,
  type MembershipAction,
} from "@/lib/admin-api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MembershipHistoryDialog } from "@/components/admin/MembershipHistoryDialog";

type FilterValue = "all" | MembershipStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_VARIANT: Record<string, any> = {
  pending: "secondary",
  active: "default",
  past_due: "destructive",
  paused: "secondary",
  cancelled: "outline",
};

export default function AdminMembershipsPage() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{ row: AdminMembershipRow; action: MembershipAction } | null>(null);
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminMemberships(filter, search));
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const requestAction = (row: AdminMembershipRow, action: MembershipAction) => {
    setReason("");
    setAdminNotes(row.admin_notes ?? "");
    setExtendDate(row.current_period_end ? row.current_period_end.slice(0, 10) : "");
    setActionTarget({ row, action });
  };

  const performAction = async () => {
    if (!actionTarget) return;
    const { row, action } = actionTarget;
    if (action === "decline" && !reason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    if (action === "extend" && !extendDate) {
      toast({ title: "Date required", variant: "destructive" });
      return;
    }
    setBusyId(row.id);
    try {
      await adminMembershipAction({
        membership_id: row.id,
        action,
        reason: reason || undefined,
        admin_notes: adminNotes || undefined,
        new_period_end: action === "extend" ? new Date(extendDate).toISOString() : undefined,
      });
      toast({ title: "Done", description: `${action} applied` });
      setActionTarget(null);
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const renderActions = (row: AdminMembershipRow) => {
    const buttons: { label: string; action: MembershipAction; icon: any; variant?: any }[] = [];
    if (row.status === "pending") {
      buttons.push({ label: "Approve", action: "approve", icon: Check });
      buttons.push({ label: "Decline", action: "decline", icon: X, variant: "destructive" });
    }
    if (row.status === "active") {
      buttons.push({ label: "Pause", action: "pause", icon: Pause, variant: "secondary" });
      buttons.push({ label: "Cancel", action: "cancel", icon: Ban, variant: "destructive" });
      buttons.push({ label: "Extend", action: "extend", icon: Clock, variant: "outline" });
    }
    if (row.status === "past_due") {
      buttons.push({ label: "Mark active", action: "mark_active", icon: Check });
      buttons.push({ label: "Cancel", action: "cancel", icon: Ban, variant: "destructive" });
    }
    if (row.status === "paused") {
      buttons.push({ label: "Reactivate", action: "reactivate", icon: Play });
      buttons.push({ label: "Cancel", action: "cancel", icon: Ban, variant: "destructive" });
    }
    if (row.status === "cancelled") {
      buttons.push({ label: "Reactivate", action: "reactivate", icon: Play, variant: "outline" });
    }
    return buttons.map((b) => {
      const Icon = b.icon;
      return (
        <Button
          key={b.action + b.label}
          size="sm"
          variant={b.variant ?? "default"}
          disabled={busyId === row.id}
          onClick={() => requestAction(row, b.action)}
        >
          <Icon className="h-3 w-3 mr-1" /> {b.label}
        </Button>
      );
    });
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Memberships</h1>
        <p className="text-sm text-muted-foreground">Approve, decline, pause, cancel or reactivate user memberships.</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
        <TabsList className="flex-wrap h-auto">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user name or plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No memberships found.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-4 flex flex-wrap items-start gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={row.user_avatar ?? undefined} />
                  <AvatarFallback>{(row.user_full_name?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.user_full_name || "Unnamed"}</p>
                    <Badge variant={STATUS_VARIANT[row.status]}>{row.status.replace("_", " ")}</Badge>
                    {row.requires_admin_approval && row.status === "pending" && (
                      <Badge variant="outline">Awaiting review</Badge>
                    )}
                    {row.is_fear_free_member && <Badge variant="secondary">Fear Free</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.plan_label} · {row.plan_species} · {row.billing_interval}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(row.created_at).toLocaleDateString()}
                    {row.started_at && ` · Started ${new Date(row.started_at).toLocaleDateString()}`}
                    {row.current_period_end && ` · Renews ${new Date(row.current_period_end).toLocaleDateString()}`}
                  </p>
                  {row.rejection_reason && (
                    <p className="text-xs text-destructive">Reason: {row.rejection_reason}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {renderActions(row)}
                  <Button size="sm" variant="ghost" onClick={() => setHistoryId(row.id)}>
                    <History className="h-3 w-3 mr-1" /> History
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MembershipHistoryDialog
        membershipId={historyId}
        open={!!historyId}
        onOpenChange={(v) => !v && setHistoryId(null)}
      />

      <Dialog open={!!actionTarget} onOpenChange={(v) => !v && setActionTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action.replace("_", " ")} membership
            </DialogTitle>
          </DialogHeader>
          {actionTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {actionTarget.row.user_full_name || "Unnamed"} · {actionTarget.row.plan_label}
              </p>

              {actionTarget.action === "extend" && (
                <div>
                  <Label className="text-xs">New period end</Label>
                  <Input type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} />
                </div>
              )}

              {(actionTarget.action === "decline" || actionTarget.action === "cancel") && (
                <div>
                  <Label className="text-xs">Reason {actionTarget.action === "decline" && "(required)"}</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. incomplete details" />
                </div>
              )}

              <div>
                <Label className="text-xs">Admin notes (internal)</Label>
                <Textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </div>

              {(actionTarget.action === "cancel" || actionTarget.action === "pause") && actionTarget.row.stripe_subscription_id && (
                <p className="text-xs text-muted-foreground">
                  Stripe subscription will also be {actionTarget.action === "cancel" ? "cancelled" : "paused"}.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionTarget(null)}>Cancel</Button>
            <Button
              onClick={performAction}
              disabled={busyId === actionTarget?.row.id}
              variant={actionTarget?.action === "decline" || actionTarget?.action === "cancel" ? "destructive" : "default"}
            >
              {busyId && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
