import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, ArrowDownRight, ArrowUpRight, CreditCard } from "lucide-react";
import { fetchWallet, fetchTransactions, Wallet, WalletTransaction } from "@/lib/community-api";

export function WalletView() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchWallet(user.id).then(async (w) => {
      setWallet(w);
      if (w) {
        const txns = await fetchTransactions(w.id);
        setTransactions(txns);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="animate-pulse text-muted-foreground">Loading wallet...</div>;
  if (!wallet) return <p className="text-muted-foreground">No wallet found.</p>;

  const totalBalance = Number(wallet.wallet_balance) + Number(wallet.direct_pay_balance);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">My Wallet</h1>
        <p className="text-muted-foreground mt-1">Manage your funds and track transactions</p>
      </div>

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
    </div>
  );
}
