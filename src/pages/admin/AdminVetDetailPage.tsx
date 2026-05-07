import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, Loader2, Mail, MapPin, Phone, Globe, Trash2, FileCheck, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchAdminVetDetail,
  setVetApproval,
  setVetLicenseVerified,
  setVetFearFreeVerified,
  getVetCredentialSignedUrl,
  fetchAdminVetServices,
  setVetServiceActive,
  deleteVetService,
  fetchAdminVetAppointments,
  updateAdminAppointment,
  deleteAdminAppointment,
  type AdminVetRow,
  type AdminVetService,
  type AdminVetAppointment,
} from "@/lib/admin-api";

const APPT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

const STATUS_VARIANT: Record<string, any> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default function AdminVetDetailPage() {
  const { vetProfileId } = useParams();
  const [vet, setVet] = useState<AdminVetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<AdminVetService[]>([]);
  const [appointments, setAppointments] = useState<AdminVetAppointment[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteService, setDeleteService] = useState<AdminVetService | null>(null);
  const [deleteAppt, setDeleteAppt] = useState<AdminVetAppointment | null>(null);

  const loadAll = async () => {
    if (!vetProfileId) return;
    setLoading(true);
    try {
      const [v, s, a] = await Promise.all([
        fetchAdminVetDetail(vetProfileId),
        fetchAdminVetServices(vetProfileId),
        fetchAdminVetAppointments(vetProfileId, statusFilter),
      ]);
      setVet(v);
      setServices(s);
      setAppointments(a);
    } catch (e: any) {
      toast({ title: "Failed to load vet", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vetProfileId]);

  useEffect(() => {
    if (!vetProfileId) return;
    fetchAdminVetAppointments(vetProfileId, statusFilter).then(setAppointments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const toggleApproval = async () => {
    if (!vet) return;
    setBusy("approval");
    try {
      await setVetApproval(vet.id, !vet.is_approved);
      toast({ title: vet.is_approved ? "Approval revoked" : "Vet approved" });
      const fresh = await fetchAdminVetDetail(vet.id);
      setVet(fresh);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggleLicense = async () => {
    if (!vet) return;
    setBusy("license");
    try {
      await setVetLicenseVerified(vet.id, !vet.is_license_verified);
      const fresh = await fetchAdminVetDetail(vet.id);
      setVet(fresh);
      toast({ title: !vet.is_license_verified ? "License verified" : "License verification revoked" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggleFearFree = async () => {
    if (!vet) return;
    setBusy("ff");
    try {
      await setVetFearFreeVerified(vet.id, !vet.fear_free_certified);
      const fresh = await fetchAdminVetDetail(vet.id);
      setVet(fresh);
      toast({ title: !vet.fear_free_certified ? "Fear Free verified" : "Fear Free verification revoked" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const openCredential = async (path: string | null) => {
    if (!path) return;
    const url = await getVetCredentialSignedUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast({ title: "Could not open document", variant: "destructive" });
  };

  const toggleServiceActive = async (svc: AdminVetService) => {
    setBusy(`svc-${svc.id}`);
    try {
      await setVetServiceActive(svc.id, !svc.is_active);
      setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, is_active: !s.is_active } : s)));
      toast({ title: !svc.is_active ? "Service activated" : "Service deactivated" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteService = async () => {
    if (!deleteService) return;
    setBusy(`svc-${deleteService.id}`);
    try {
      await deleteVetService(deleteService.id);
      setServices((prev) => prev.filter((s) => s.id !== deleteService.id));
      toast({ title: "Service deleted" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
      setDeleteService(null);
    }
  };

  const changeApptStatus = async (appt: AdminVetAppointment, status: string) => {
    setBusy(`appt-${appt.id}`);
    try {
      await updateAdminAppointment(appt.id, { status });
      setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, status } : a)));
      toast({ title: "Appointment updated" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAppt = async () => {
    if (!deleteAppt) return;
    setBusy(`appt-${deleteAppt.id}`);
    try {
      await deleteAdminAppointment(deleteAppt.id);
      setAppointments((prev) => prev.filter((a) => a.id !== deleteAppt.id));
      toast({ title: "Appointment removed" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
      setDeleteAppt(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vet) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Vet profile not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/admin/vets"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/vets"><ArrowLeft className="h-4 w-4 mr-1" /> All vets</Link>
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4 md:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-16 w-16">
                <AvatarImage src={vet.owner_avatar_url ?? undefined} />
                <AvatarFallback>{(vet.clinic_name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold truncate">{vet.clinic_name}</h1>
                  <Badge variant={vet.is_approved ? "default" : "secondary"}>
                    {vet.is_approved ? "Approved" : "Pending"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{vet.owner_full_name ?? "Unknown owner"}</p>
                <div className="flex gap-3 flex-wrap text-sm text-muted-foreground mt-1">
                  {vet.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{vet.location}</span>}
                  {vet.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{vet.phone}</span>}
                  {vet.website && (
                    <a href={vet.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                      <Globe className="h-3 w-3" />Website
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Approved</span>
              <Switch checked={vet.is_approved} onCheckedChange={toggleApproval} disabled={busy === "approval"} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="consultations">Consultations ({appointments.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Bio</CardTitle></CardHeader>
            <CardContent>
              {vet.bio ? <p className="whitespace-pre-wrap text-sm">{vet.bio}</p> : <p className="text-sm text-muted-foreground">No bio provided.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Specializations</CardTitle></CardHeader>
            <CardContent>
              {vet.specializations && vet.specializations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {vet.specializations.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None listed.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardContent className="p-4">
              {services.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No services configured.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{s.name}</p>
                          {!s.is_active && <Badge variant="outline">Inactive</Badge>}
                        </div>
                        {s.description && <p className="text-sm text-muted-foreground truncate">{s.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          ${Number(s.price).toFixed(2)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Active</span>
                          <Switch
                            checked={s.is_active}
                            onCheckedChange={() => toggleServiceActive(s)}
                            disabled={busy === `svc-${s.id}`}
                          />
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteService(s)} disabled={busy === `svc-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultations" className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {APPT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-4">
              {appointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No consultations.</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((a) => (
                    <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{a.pet_name ?? "Pet"}</p>
                          <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>{a.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.owner_full_name ?? "Unknown owner"}
                          {a.service_name ? ` • ${a.service_name}` : ""}
                          {a.service_price != null ? ` • $${Number(a.service_price).toFixed(2)}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(a.scheduled_at).toLocaleString()}
                        </p>
                        {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{a.notes}"</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={a.status}
                          onValueChange={(v) => changeApptStatus(a, v)}
                          disabled={busy === `appt-${a.id}`}
                        >
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {APPT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteAppt(a)} disabled={busy === `appt-${a.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <FileCheck className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">View vet payment tickets in the dedicated section.</p>
              <Button asChild>
                <Link to="/admin/vet-tickets">Open Vet Tickets</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteService} onOpenChange={(o) => !o && setDeleteService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteService?.name}" will be permanently removed. Existing appointments referencing it stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAppt} onOpenChange={(o) => !o && setDeleteAppt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the consultation record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAppt}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
