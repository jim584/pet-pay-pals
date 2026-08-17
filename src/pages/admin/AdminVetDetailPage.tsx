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
import { ArrowLeft, BadgeCheck, Check, Loader2, Mail, MapPin, Phone, Globe, Trash2, FileCheck, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchAdminVetDetail,
  setVetApproval,
  setVetAccountStatus,
  getVetIdentitySignedUrl,
  setVetLicenseVerified,
  setVetFearFreeVerified,
  getVetCredentialSignedUrl,
  fetchAdminVetServices,
  setVetServiceActive,
  deleteVetService,
  fetchAdminVetAppointments,
  updateAdminAppointment,
  deleteAdminAppointment,
  fetchVetVerificationAttempts,
  retryVetVerification,
  type AdminVetRow,
  type AdminVetService,
  type AdminVetAppointment,
  type VetVerificationAttempt,
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
  const [attempts, setAttempts] = useState<VetVerificationAttempt[]>([]);
  const [identityUrl, setIdentityUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadAll = async () => {
    if (!vetProfileId) return;
    setLoading(true);
    try {
      const [v, s, a, at] = await Promise.all([
        fetchAdminVetDetail(vetProfileId),
        fetchAdminVetServices(vetProfileId),
        fetchAdminVetAppointments(vetProfileId, statusFilter),
        fetchVetVerificationAttempts(vetProfileId, 10),
      ]);
      setVet(v);
      setServices(s);
      setAppointments(a);
      setAttempts(at);
      setIdentityUrl(v?.identity_photo_path ? await getVetIdentitySignedUrl(v.identity_photo_path) : null);
    } catch (e: any) {
      toast({ title: "Failed to load vet", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryVerification = async () => {
    if (!vet) return;
    setBusy("retry");
    try {
      await retryVetVerification(vet.id);
      toast({ title: "Re-checked", description: "Verification refreshed." });
      const [fresh, freshAttempts] = await Promise.all([
        fetchAdminVetDetail(vet.id),
        fetchVetVerificationAttempts(vet.id, 10),
      ]);
      setVet(fresh);
      setAttempts(freshAttempts);
    } catch (e: any) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
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

  const changeAccountStatus = async (
    status: "pending_verification" | "verified" | "rejected",
  ) => {
    if (!vet) return;
    if (status === "rejected" && !rejectReason.trim()) {
      toast({ title: "Add a reason", description: "Tell the vet why the account was not approved.", variant: "destructive" });
      return;
    }
    setBusy("account");
    try {
      await setVetAccountStatus(vet.id, status, status === "rejected" ? rejectReason.trim() : null);
      toast({ title: status === "verified" ? "Account verified" : status === "rejected" ? "Account rejected" : "Account set back to pending" });
      setRejectReason("");
      await loadAll();
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Account verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                vet.account_status === "verified"
                  ? "default"
                  : vet.account_status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
            >
              {vet.account_status === "verified"
                ? "Verified"
                : vet.account_status === "rejected"
                ? "Rejected"
                : "Pending verification"}
            </Badge>
            {vet.identity_reviewed_at && (
              <span className="text-xs text-muted-foreground">
                reviewed {new Date(vet.identity_reviewed_at).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name on file: </span>
                {[vet.first_name, vet.last_name].filter(Boolean).join(" ") || "—"}</p>
              <p><span className="text-muted-foreground">License: </span>
                {vet.license_number ? `${vet.license_number}${vet.license_state ? ` · ${vet.license_state}` : ""}` : "—"}</p>
              <p><span className="text-muted-foreground">Merchant ID: </span>{vet.merchant_id || "—"}</p>
              <p><span className="text-muted-foreground">Photo taken: </span>
                {vet.identity_photo_captured_at ? new Date(vet.identity_photo_captured_at).toLocaleString() : "Not submitted"}</p>
            </div>
            <div className="rounded-lg border overflow-hidden bg-muted aspect-[4/3] flex items-center justify-center">
              {identityUrl ? (
                <img src={identityUrl} alt="Veterinarian identity photo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground p-4 text-center">No identity photo submitted yet</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Reason (required when rejecting)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy === "account" || vet.account_status === "verified" || !vet.identity_photo_path}
                onClick={() => changeAccountStatus("verified")}
              >
                <Check className="h-3 w-3 mr-1" /> Approve account
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy === "account" || vet.account_status === "rejected"}
                onClick={() => changeAccountStatus("rejected")}
              >
                Reject
              </Button>
              {vet.account_status !== "pending_verification" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === "account"}
                  onClick={() => changeAccountStatus("pending_verification")}
                >
                  Back to pending
                </Button>
              )}
            </div>
            {!vet.identity_photo_path && (
              <p className="text-xs text-muted-foreground">
                Approval is blocked until the vet submits a live identity photo.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Veterinary license</span>
                <Badge variant={vet.is_license_verified ? "default" : "outline"}>
                  {vet.is_license_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {vet.license_number ? `${vet.license_number}${vet.license_state ? ` · ${vet.license_state}` : ""}` : "No license number on file"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!vet.license_document_url}
                onClick={() => openCredential(vet.license_document_url)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {vet.license_document_url ? "View document" : "No document"}
              </Button>
              <span className="text-xs text-muted-foreground">Verified</span>
              <Switch checked={vet.is_license_verified} onCheckedChange={toggleLicense} disabled={busy === "license"} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Fear Free certification</span>
                <Badge variant={vet.fear_free_certified ? "default" : "outline"}>
                  {vet.fear_free_certified ? "Verified" : "Not verified"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {vet.fear_free_cert_number ?? "No cert number on file"}
                {vet.fear_free_verified_at && vet.fear_free_certified
                  ? ` · verified ${new Date(vet.fear_free_verified_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!vet.fear_free_cert_url}
                onClick={() => openCredential(vet.fear_free_cert_url)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {vet.fear_free_cert_url ? "View certificate" : "No certificate"}
              </Button>
              <span className="text-xs text-muted-foreground">Verified</span>
              <Switch checked={vet.fear_free_certified} onCheckedChange={toggleFearFree} disabled={busy === "ff"} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Members whose pet's Vet of Record has Fear Free verified automatically qualify for the 5% Fear Free membership discount on checkout.
          </p>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium text-sm">Automated verification</p>
                <p className="text-xs text-muted-foreground">
                  Status: <Badge variant="outline" className="ml-1">{vet.verification_status}</Badge>
                  {vet.verification_checked_at && ` · last checked ${new Date(vet.verification_checked_at).toLocaleString()}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleRetryVerification} disabled={busy === "retry"}>
                {busy === "retry" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                Retry now
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-medium mb-1">License</p>
                <p className="text-muted-foreground">
                  Legal name: {vet.license_full_legal_name ?? "—"}<br />
                  Reason: {vet.verification_reason ?? "—"}<br />
                  Source: {vet.verification_source ?? "—"}
                  {vet.verification_source_url && (
                    <> · <a className="underline" href={vet.verification_source_url} target="_blank" rel="noreferrer">open</a></>
                  )}
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Fear Free</p>
                <p className="text-muted-foreground">
                  Status: {vet.fear_free_verification_status}<br />
                  Reason: {vet.fear_free_reason ?? "—"}<br />
                  Source: {vet.fear_free_source ?? "—"}
                </p>
              </div>
            </div>
            {attempts.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Recent attempts</p>
                <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                  {attempts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                      <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                      <span className="text-muted-foreground">{new Date(a.attempted_at).toLocaleString()}</span>
                      <span className="ml-auto">{a.status}</span>
                      {a.http_status && <span className="text-muted-foreground">HTTP {a.http_status}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Never auto-flags unverified on source outage — retries continue up to 72h and admin can override anytime using the toggles above.
            </p>
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
