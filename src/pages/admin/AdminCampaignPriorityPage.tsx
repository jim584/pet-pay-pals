import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ListOrdered, Info } from "lucide-react";
import { toast } from "sonner";
import { listCampaignsForPriority, setCampaignPriority } from "@/lib/help-now-campaigns-api";
import { collectPriorityInputs, OFFICIAL_HIERARCHY_PENDING } from "@/lib/help-now-priority";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

function RankCell({ id, rank }: { id: string; rank: number | null }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(rank === null ? "" : String(rank));

  const save = useMutation({
    mutationFn: () => {
      const trimmed = value.trim();
      if (trimmed === "") return setCampaignPriority(id, null);
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 1) throw new Error("Rank must be a whole number of 1 or more");
      return setCampaignPriority(id, n);
    },
    onSuccess: () => {
      toast.success("Priority updated");
      qc.invalidateQueries({ queryKey: ["campaignPriority"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 w-20"
        inputMode="numeric"
        placeholder="—"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Priority rank"
      />
      <Button size="sm" variant="ghost" onClick={() => save.mutate()} disabled={save.isPending}>
        Save
      </Button>
    </div>
  );
}

export default function AdminCampaignPriorityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaignPriority"],
    queryFn: listCampaignsForPriority,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-primary" /> Help a Pet Now priority
        </h1>
        <p className="text-sm text-muted-foreground">
          The eligibility facts a priority rule reads, per case. Priority affects feed ordering and
          the order redirected donations are allocated. It is never shown to members or donors.
        </p>
      </div>

      {OFFICIAL_HIERARCHY_PENDING && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Automatic ranking is pending the official Help a Pet Now priority hierarchy. Until it is
            supplied, cases keep their existing order and no criteria are applied automatically. A
            rank entered here is honoured ahead of that fallback.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Eligible-case inputs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Documentation</TableHead>
                    <TableHead>Disbursement</TableHead>
                    <TableHead className="text-right">Remaining need</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => {
                    const i = collectPriorityInputs(c as never);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate font-medium">
                            {c.title ?? c.pet?.name ?? "Untitled case"}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.id.slice(0, 8)}</p>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{i.status}</Badge></TableCell>
                        <TableCell className="text-xs">{i.verification_status ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {i.document_basis ?? "—"} · invoice {i.invoice_status ?? "none"} · proof{" "}
                          {i.proof_of_payment_status ?? "none"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {i.disbursement_eligible ? "Eligible" : "Not cleared"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {fmt(i.remaining_eligible_need)}
                        </TableCell>
                        <TableCell><RankCell id={c.id} rank={i.priority_rank} /></TableCell>
                        <TableCell className="text-xs">{i.priority_source}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
