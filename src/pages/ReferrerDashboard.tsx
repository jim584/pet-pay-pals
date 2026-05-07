import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMyReferrer, listMyReferrals, listMyBounties, listMyPayouts, listMyMilestones,
  startConnectOnboarding, refreshConnectStatus,
  type Referrer, type Referral, type ReferralBounty, type ReferrerPayout, type ShelterMilestone,
} from "@/lib/referrals-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { QRCodeCard } from "@/components/QRCodeCard";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2 } from "lucide-react";

export default function ReferrerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [referrer, setReferrer] = useState<Referrer | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [bounties, setBounties] = useState<ReferralBounty[]>([]);
  const [payouts, setPayouts] = useState<ReferrerPayout[]>([]);
  const [milestones, setMilestones] = useState<ShelterMilestone[]>([]);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await getMyReferrer();
    if (!r) {
      toast.error("You don't have a referrer profile yet.");
      navigate("/");
      return;
    }
    setReferrer(r);
    const [refs, bs, ps, ms] = await Promise.all([
      listMyReferrals(), listMyBounties(), listMyPayouts(),
      r.type === "shelter" ? listMyMilestones() : Promise.resolve([]),
    ]);
    setReferrals(refs); setBounties(bs); setPayouts(ps); setMilestones(ms);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user, authLoading]);

  useEffect(() => {
    if (params.get("onboarded") === "1") {
      refreshConnectStatus().then((s) => {
        if (s) toast.success(`Stripe Connect status: ${s}`);
        load();
      }).catch(() => {});
    }
  }, [params]);

  if (authLoading || loading || !referrer) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const shareUrl = `${window.location.origin}/auth?ref=${referrer.code}`;
  const totalRefs = referrals.length;
  const activeRefs = referrals.filter(r => r.status === "active").length;
  const sumBy = (s: string) => bounties.filter(b => b.status === s).reduce((a, b) => a + Number(b.bounty_amount), 0);
  const pendingTotal = sumBy("pending");
  const availableTotal = sumBy("available");
  const paidTotal = payouts.filter(p => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);

  const onboardConnect = async () => {
    setConnecting(true);
    try {
      const url = await startConnectOnboarding();
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start Stripe onboarding");
    } finally {
      setConnecting(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">Referrer Dashboard</CardTitle>
            <p className="text-muted-foreground">{referrer.display_name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{referrer.type}</Badge>
              {referrer.fear_free_certified && <Badge>Fear Free Certified</Badge>}
              <Badge variant="outline">Code: {referrer.code}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted p-2 rounded break-all max-w-xs">{shareUrl}</code>
              <Button size="sm" variant="outline" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
            </div>
            {referrer.stripe_connect_status === "active" ? (
              <Badge variant="default">Stripe Connect: active</Badge>
            ) : (
              <Button size="sm" onClick={onboardConnect} disabled={connecting}>
                {connecting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {referrer.stripe_connect_status === "pending" ? "Continue Stripe onboarding" : "Connect Stripe for payouts"}
                <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Referrals" value={totalRefs} />
        <Stat label="Active" value={activeRefs} />
        <Stat label="Pending $" value={`$${pendingTotal.toFixed(2)}`} />
        <Stat label="Available $" value={`$${availableTotal.toFixed(2)}`} />
        <Stat label="Lifetime paid" value={`$${paidTotal.toFixed(2)}`} />
      </div>

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="bounties">Bounties</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          {referrer.type === "shelter" && <TabsTrigger value="milestones">Milestones</TabsTrigger>}
          <TabsTrigger value="share">Share</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Member</TableHead><TableHead>Status</TableHead>
                <TableHead>Activated</TableHead><TableHead>Created</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {referrals.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No referrals yet.</TableCell></TableRow>}
                {referrals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.member_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>{r.activated_at ? new Date(r.activated_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bounties">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Period</TableHead><TableHead>Rate</TableHead><TableHead>Amount</TableHead>
                <TableHead>Status</TableHead><TableHead>Hold until</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bounties.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No bounties yet.</TableCell></TableRow>}
                {bounties.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{b.period}</TableCell>
                    <TableCell>{(Number(b.rate) * 100).toFixed(1)}%</TableCell>
                    <TableCell>${Number(b.bounty_amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                    <TableCell>{new Date(b.hold_until).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead>
                <TableHead>Status</TableHead><TableHead>Reference</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payouts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No payouts yet.</TableCell></TableRow>}
                {payouts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs">{p.external_ref ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {referrer.type === "shelter" && (
          <TabsContent value="milestones">
            <Card><CardContent className="pt-6 space-y-4">
              {milestones.length === 0 && <p className="text-muted-foreground text-center">No milestones yet.</p>}
              {milestones.map(m => {
                const pct = Math.min(100, (Number(m.raised_amount) / Number(m.goal_amount)) * 100);
                return (
                  <div key={m.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">{m.pet_name}</p>
                        <p className="text-sm text-muted-foreground">Payout: ${Number(m.payout_amount).toFixed(2)}</p>
                      </div>
                      <Badge variant="outline">{m.status}</Badge>
                    </div>
                    <Progress value={pct} />
                    <p className="text-sm text-muted-foreground">
                      ${Number(m.raised_amount).toFixed(2)} / ${Number(m.goal_amount).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </CardContent></Card>
          </TabsContent>
        )}

        <TabsContent value="share">
          <Card><CardContent className="pt-6 flex justify-center">
            <QRCodeCard value={shareUrl} label={shareUrl} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
