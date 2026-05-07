import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Check, X, Eye, Stethoscope } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { fetchAdminVets, setVetApproval, type AdminVetRow, type VetApprovalFilter } from "@/lib/admin-api";

const FILTERS: { value: VetApprovalFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "approved", label: "Approved" },
  { value: "all", label: "All" },
];

export default function AdminVetsPage() {
  const [filter, setFilter] = useState<VetApprovalFilter>("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminVetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminVetRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminVets(filter, search);
      setRows(data);
    } catch (e: any) {
      toast({ title: "Failed to load vets", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleApproval = async (vet: AdminVetRow, approved: boolean) => {
    setBusyId(vet.id);
    try {
      await setVetApproval(vet.id, approved);
      toast({ title: approved ? "Vet approved" : "Approval revoked" });
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
      setRevokeTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vets</h1>
        <p className="text-muted-foreground">Approve, review, and manage clinic profiles.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as VetApprovalFilter)}>
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clinic, owner or location"
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
              <Stethoscope className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No vets found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={v.owner_avatar_url ?? undefined} />
                      <AvatarFallback>
                        {(v.clinic_name || v.owner_full_name || "?").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{v.clinic_name || "(unnamed clinic)"}</p>
                        <Badge variant={v.is_approved ? "default" : "secondary"}>
                          {v.is_approved ? "Approved" : "Pending"}
                        </Badge>
                        {v.is_approved && v.license_document_url && !v.is_license_verified && (
                          <Badge variant="outline" className="text-xs">License unverified</Badge>
                        )}
                        {v.is_approved && v.fear_free_cert_url && !v.fear_free_certified && (
                          <Badge variant="outline" className="text-xs">Fear Free pending</Badge>
                        )}
                        {v.fear_free_certified && (
                          <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20">Fear Free ✓</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {v.owner_full_name ?? "Unknown owner"}
                        {v.location ? ` • ${v.location}` : ""}
                        {v.phone ? ` • ${v.phone}` : ""}
                      </p>
                      {v.specializations && v.specializations.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {v.specializations.slice(0, 4).map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {v.is_approved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRevokeTarget(v)}
                        disabled={busyId === v.id}
                      >
                        <X className="h-4 w-4 mr-1" /> Revoke
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleApproval(v, true)}
                        disabled={busyId === v.id}
                      >
                        {busyId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                        Approve
                      </Button>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/admin/vets/${v.id}`}>
                        <Eye className="h-4 w-4 mr-1" /> Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke approval?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.clinic_name} will no longer appear as an approved clinic. You can re-approve later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => revokeTarget && handleApproval(revokeTarget, false)}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
