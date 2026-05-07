import { Fragment, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Copy, RefreshCw, Plus, DollarSign, QrCode, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCard } from "@/components/QRCodeCard";
import ReferralReconcileTab from "@/components/admin/ReferralReconcileTab";
import {
  listReferrers, listReferrals, listBounties, listPayouts,
  createReferrer, updateReferrer, runReferralHoldJob, createPayoutForReferrer,
  getReferralSettings, updateReferralSettings,
  payReferrerViaStripe, listMilestones, createMilestone, recordMilestoneContribution,
  listMilestoneContributions,
  type Referrer, type Referral, type ReferralBounty, type ReferrerPayout, type ReferralSettings, type ReferrerType,
  type ShelterMilestone, type MilestoneContribution,
} from "@/lib/referrals-api";

const fmt = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";

export default function AdminReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [bounties, setBounties] = useState<ReferralBounty[]>([]);
  const [payouts, setPayouts] = useState<ReferrerPayout[]>([]);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [referralFilter, setReferralFilter] = useState("all");
  const [bountyFilter, setBountyFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [milestones, setMilestones] = useState<ShelterMilestone[]>([]);
  const [qrFor, setQrFor] = useState<Referrer | null>(null);
  const [openMilestone, setOpenMilestone] = useState(false);
  const [newMs, setNewMs] = useState({ referrer_id: "", pet_name: "", goal_amount: 0, payout_amount: 0 });
  const [expandedMs, setExpandedMs] = useState<Record<string, boolean>>({});
  const [contribsByMs, setContribsByMs] = useState<Record<string, MilestoneContribution[]>>({});
  const [contribsLoading, setContribsLoading] = useState<Record<string, boolean>>({});

  const toggleMilestone = async (id: string) => {
    setExpandedMs(s => ({ ...s, [id]: !s[id] }));
    if (!contribsByMs[id]) {
      setContribsLoading(s => ({ ...s, [id]: true }));
      try {
        const rows = await listMilestoneContributions(id);
        setContribsByMs(s => ({ ...s, [id]: rows }));
      } catch (e: any) { toast.error(e.message); }
      finally { setContribsLoading(s => ({ ...s, [id]: false })); }
    }
  };
  const refreshContribs = async (id: string) => {
    try {
      const rows = await listMilestoneContributions(id);
      setContribsByMs(s => ({ ...s, [id]: rows }));
    } catch {}
  };

  // Create referrer dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [newRef, setNewRef] = useState<{ display_name: string; type: ReferrerType; payout_email: string; fear_free_certified: boolean }>({
    display_name: "", type: "vet", payout_email: "", fear_free_certified: false,
  });

  const load = async () => {
    const [r, rs, b, p, s, ms] = await Promise.all([
      listReferrers(), listReferrals(referralFilter), listBounties(bountyFilter), listPayouts(),
      getReferralSettings(), listMilestones(),
    ]);
    setReferrers(r); setReferrals(rs); setBounties(b); setPayouts(p); setSettings(s); setMilestones(ms);
  };

  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, []);
  useEffect(() => { listReferrals(referralFilter).then(setReferrals).catch(() => {}); }, [referralFilter]);
  useEffect(() => { listBounties(bountyFilter).then(setBounties).catch(() => {}); }, [bountyFilter]);

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/auth?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };

  const handleCreate = async () => {
    if (!newRef.display_name) { toast.error("Display name required"); return; }
    setBusy(true);
    try {
      await createReferrer(newRef);
      toast.success("Referrer created");
      setOpenCreate(false);
      setNewRef({ display_name: "", type: "vet", payout_email: "", fear_free_certified: false });
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const toggleActive = async (r: Referrer) => {
    try { await updateReferrer(r.id, { is_active: !r.is_active }); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const toggleFF = async (r: Referrer) => {
    try { await updateReferrer(r.id, { fear_free_certified: !r.fear_free_certified }); await load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const runHoldJob = async () => {
    setBusy(true);
    try { const r = await runReferralHoldJob(); toast.success(`${r.promoted} bounties moved to available`); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handlePayout = async (referrerId: string) => {
    setBusy(true);
    try {
      const r = await createPayoutForReferrer(referrerId);
      toast.success(`Paid ${fmt(r.total)} (${r.count} bounties)`);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleStripePayout = async (referrerId: string) => {
    setBusy(true);
    try {
      const r = await payReferrerViaStripe(referrerId);
      toast.success(`Stripe transfer $${r.amount.toFixed(2)} (${r.count} bounties)`);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleCreateMilestone = async () => {
    if (!newMs.referrer_id || !newMs.pet_name || !newMs.goal_amount || !newMs.payout_amount) {
      toast.error("All fields required"); return;
    }
    setBusy(true);
    try {
      await createMilestone(newMs);
      toast.success("Milestone created");
      setOpenMilestone(false);
      setNewMs({ referrer_id: "", pet_name: "", goal_amount: 0, payout_amount: 0 });
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleAddContribution = async (mid: string) => {
    const v = window.prompt("Contribution amount ($):");
    if (!v) return;
    const n = parseFloat(v);
    if (!n || n <= 0) return;
    try {
      await recordMilestoneContribution(mid, n, "manual");
      toast.success("Recorded");
      await load();
      if (expandedMs[mid]) await refreshContribs(mid);
    } catch (e: any) { toast.error(e.message); }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setBusy(true);
    try { await updateReferralSettings(settings.id, settings); toast.success("Settings saved"); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  // Outstanding (available) per referrer
  const outstandingByReferrer = new Map<string, number>();
  bounties.filter(b => b.status === "available").forEach(b => {
    outstandingByReferrer.set(b.referrer_id, (outstandingByReferrer.get(b.referrer_id) ?? 0) + Number(b.bounty_amount));
  });

  if (loading) return <div className="space-y-4 max-w-6xl mx-auto"><Skeleton className="h-10 w-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Referrals & Bounties</h1>
          <p className="text-sm text-muted-foreground">Manage referrers, track bounties, and pay out earnings.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runHoldJob} disabled={busy} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} /> Run hold-expiry job
          </Button>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New referrer</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create referrer</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Display name</Label><Input value={newRef.display_name} onChange={e => setNewRef({ ...newRef, display_name: e.target.value })} /></div>
                <div><Label>Type</Label>
                  <Select value={newRef.type} onValueChange={(v: ReferrerType) => setNewRef({ ...newRef, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vet">Veterinarian</SelectItem>
                      <SelectItem value="shelter">Shelter</SelectItem>
                      <SelectItem value="influencer">Influencer</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Payout email</Label><Input type="email" value={newRef.payout_email} onChange={e => setNewRef({ ...newRef, payout_email: e.target.value })} /></div>
                {newRef.type === "vet" && (
                  <div className="flex items-center justify-between">
                    <Label>Fear Free certified</Label>
                    <Switch checked={newRef.fear_free_certified} onCheckedChange={v => setNewRef({ ...newRef, fear_free_certified: v })} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={busy}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="referrers">
        <TabsList>
          <TabsTrigger value="referrers">Referrers ({referrers.length})</TabsTrigger>
          <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="bounties">Bounties ({bounties.length})</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payouts.length})</TabsTrigger>
          <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="referrers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Code</TableHead>
                  <TableHead>FF certified</TableHead><TableHead>Active</TableHead>
                  <TableHead className="text-right">Available</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {referrers.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.display_name}</TableCell>
                      <TableCell><Badge variant="secondary">{r.type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell>
                        {r.type === "vet"
                          ? <Switch checked={r.fear_free_certified} onCheckedChange={() => toggleFF(r)} />
                          : <span className="text-muted-foreground text-xs">N/A</span>}
                      </TableCell>
                      <TableCell><Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} /></TableCell>
                      <TableCell className="text-right font-mono">{fmt(outstandingByReferrer.get(r.id) ?? 0)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => copyLink(r.code)} title="Copy link"><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setQrFor(r)} title="Show QR"><QrCode className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" disabled={busy || !(outstandingByReferrer.get(r.id) ?? 0)} onClick={() => handlePayout(r.id)} title="Manual payout">
                          <DollarSign className="h-3 w-3" />
                        </Button>
                        {r.stripe_connect_status === "active" && (
                          <Button size="sm" variant="default" disabled={busy || !(outstandingByReferrer.get(r.id) ?? 0)} onClick={() => handleStripePayout(r.id)} title="Stripe payout">
                            <Zap className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {referrers.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No referrers yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-3">
          <Select value={referralFilter} onValueChange={setReferralFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending_signup">Pending signup</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Member</TableHead><TableHead>Referrer</TableHead><TableHead>Code</TableHead>
                <TableHead>Status</TableHead><TableHead>Activated</TableHead><TableHead>Created</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {referrals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.member_name ?? <span className="text-muted-foreground text-xs">{r.referred_user_id.slice(0, 8)}…</span>}</TableCell>
                    <TableCell>{r.referrer_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code_used}</TableCell>
                    <TableCell><Badge variant={r.status === "active" ? "default" : r.status === "reversed" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>{fmtDate(r.activated_at)}</TableCell>
                    <TableCell>{fmtDate(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {referrals.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No referrals.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bounties" className="space-y-3">
          <Select value={bountyFilter} onValueChange={setBountyFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending (in hold)</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Referrer</TableHead><TableHead>Period</TableHead>
                <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Invoice</TableHead>
                <TableHead className="text-right">Bounty</TableHead><TableHead>Hold until</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bounties.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{fmtDate(b.created_at)}</TableCell>
                    <TableCell>{b.referrer_name}</TableCell>
                    <TableCell><Badge variant="outline">{b.period}</Badge></TableCell>
                    <TableCell className="text-right">{(Number(b.rate) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.gross_membership_amount)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{fmt(b.bounty_amount)}</TableCell>
                    <TableCell>{fmtDate(b.hold_until)}</TableCell>
                    <TableCell><Badge variant={b.status === "available" ? "default" : b.status === "paid" ? "secondary" : b.status === "reversed" ? "destructive" : "outline"}>{b.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {bounties.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No bounties.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Referrer</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead>
                <TableHead>Status</TableHead><TableHead>External ref</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payouts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{fmtDate(p.paid_at ?? p.created_at)}</TableCell>
                    <TableCell>{p.referrer_name}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.amount)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell className="text-xs">{p.external_ref ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {payouts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payouts yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={openMilestone} onOpenChange={setOpenMilestone}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={referrers.filter(r => r.type === "shelter").length === 0}>
                  <Plus className="h-4 w-4 mr-2" /> New milestone
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create shelter milestone</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Shelter</Label>
                    <Select value={newMs.referrer_id} onValueChange={v => setNewMs({ ...newMs, referrer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select shelter" /></SelectTrigger>
                      <SelectContent>
                        {referrers.filter(r => r.type === "shelter").map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Pet name</Label>
                    <Input value={newMs.pet_name} onChange={e => setNewMs({ ...newMs, pet_name: e.target.value })} /></div>
                  <div><Label>Goal amount ($)</Label>
                    <Input type="number" value={newMs.goal_amount || ""} onChange={e => setNewMs({ ...newMs, goal_amount: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>Payout amount ($)</Label>
                    <Input type="number" value={newMs.payout_amount || ""} onChange={e => setNewMs({ ...newMs, payout_amount: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <DialogFooter><Button onClick={handleCreateMilestone} disabled={busy}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Pet</TableHead><TableHead>Shelter</TableHead>
                <TableHead className="text-right">Goal</TableHead><TableHead className="text-right">Raised</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead className="text-right">Contribs</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {milestones.map(m => {
                  const ref = referrers.find(r => r.id === m.referrer_id);
                  const isOpen = !!expandedMs[m.id];
                  const contribs = contribsByMs[m.id];
                  const pct = m.goal_amount > 0 ? Math.min(100, (Number(m.raised_amount) / Number(m.goal_amount)) * 100) : 0;
                  return (
                    <Fragment key={m.id}>
                      <TableRow className="cursor-pointer" onClick={() => toggleMilestone(m.id)}>
                        <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell>{m.pet_name}</TableCell>
                        <TableCell>{ref?.display_name ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(m.goal_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(m.raised_amount)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(m.payout_amount)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{contribs ? contribs.length : "—"}</TableCell>
                        <TableCell><Badge variant={m.status === "completed" ? "default" : "outline"}>{m.status}</Badge></TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          {m.status === "open" && <Button size="sm" variant="ghost" onClick={() => handleAddContribution(m.id)}>+ Contribution</Button>}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={m.id + "-detail"}>
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {fmt(m.raised_amount)} of {fmt(m.goal_amount)} ({pct.toFixed(1)}%)
                                  </p>
                                </div>
                              </div>
                              {contribsLoading[m.id] ? (
                                <Skeleton className="h-20 w-full" />
                              ) : !contribs || contribs.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No contributions yet.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Source</TableHead>
                                      <TableHead>Payer</TableHead>
                                      <TableHead>Stripe ref</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {contribs.map(c => {
                                      const ref = c.payment?.stripe_payment_intent_id ?? c.payment?.stripe_charge_id ?? c.payment?.stripe_invoice_id ?? null;
                                      return (
                                        <TableRow key={c.id}>
                                          <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                                          <TableCell><Badge variant="outline" className="text-xs">{c.source}</Badge></TableCell>
                                          <TableCell className="text-xs">{c.payment?.payer_name ?? "—"}</TableCell>
                                          <TableCell className="text-xs font-mono">{ref ? <span title={ref}>{ref.slice(0, 18)}…</span> : "—"}</TableCell>
                                          <TableCell className="text-xs">{c.payment?.description ?? "—"}</TableCell>
                                          <TableCell className="text-right font-mono">{fmt(c.amount)}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {milestones.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No milestones yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reconcile">
          <ReferralReconcileTab />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-base">Program settings</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              {settings && (
                <>
                  <div><Label>Intro rate (e.g. 0.05 = 5%)</Label>
                    <Input type="number" step="0.01" value={settings.intro_rate}
                      onChange={e => setSettings({ ...settings, intro_rate: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>Intro period (months)</Label>
                    <Input type="number" value={settings.intro_months}
                      onChange={e => setSettings({ ...settings, intro_months: parseInt(e.target.value) || 0 })} /></div>
                  <div><Label>Ongoing rate</Label>
                    <Input type="number" step="0.01" value={settings.ongoing_rate}
                      onChange={e => setSettings({ ...settings, ongoing_rate: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>Hold period (days)</Label>
                    <Input type="number" value={settings.hold_days}
                      onChange={e => setSettings({ ...settings, hold_days: parseInt(e.target.value) || 0 })} /></div>
                  <Button onClick={saveSettings} disabled={busy}>Save settings</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Referral QR — {qrFor?.display_name}</DialogTitle></DialogHeader>
          {qrFor && (
            <div className="flex justify-center">
              <QRCodeCard value={`${window.location.origin}/auth?ref=${qrFor.code}`} label={`${window.location.origin}/auth?ref=${qrFor.code}`} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
