import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { fetchMembershipHistory, type MembershipHistoryRow } from "@/lib/admin-api";
import { Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  membershipId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function MembershipHistoryDialog({ membershipId, open, onOpenChange }: Props) {
  const [rows, setRows] = useState<MembershipHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !membershipId) return;
    setLoading(true);
    fetchMembershipHistory(membershipId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [open, membershipId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Status history</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No history recorded.</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="border-l-2 border-muted pl-4 py-1">
                <div className="flex items-center gap-2 text-sm">
                  {r.from_status && <span className="text-muted-foreground">{r.from_status}</span>}
                  {r.from_status && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  <Badge variant="outline">{r.to_status}</Badge>
                  <Badge variant="secondary" className="text-[10px] uppercase">{r.source}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString()}</p>
                {r.reason && <p className="text-xs mt-1"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>}
                {r.notes && <p className="text-xs mt-1"><span className="text-muted-foreground">Notes:</span> {r.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
