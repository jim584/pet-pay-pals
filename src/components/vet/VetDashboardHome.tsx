import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { fetchVetProfile, fetchVetAppointments, fetchVetServices, updateAppointmentStatus, Appointment, VetService } from "@/lib/vet-api";
import { listTicketsForVet, getTicketFileSignedUrl, VetTicket } from "@/lib/vet-tickets-api";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Stethoscope, DollarSign, CheckCircle, XCircle, Clock, FileText, Ticket } from "lucide-react";

type TicketRow = VetTicket & { pet_name?: string; owner_name?: string };

export function VetDashboardHome() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<VetService[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [vetId, setVetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchVetProfile(user.id).then(async (p) => {
      if (p) {
        setVetId(p.id);
        const [appts, svcs, tix] = await Promise.all([
          fetchVetAppointments(p.id),
          fetchVetServices(p.id),
          listTicketsForVet(p.id),
        ]);
        setAppointments(appts);
        setServices(svcs);

        const petIds = Array.from(new Set(tix.map((t) => t.pet_id).filter(Boolean)));
        const ownerIds = Array.from(new Set(tix.map((t) => t.owner_id).filter(Boolean)));
        const [petsRes, profsRes] = await Promise.all([
          petIds.length
            ? supabase.from("pets").select("id, name").in("id", petIds)
            : Promise.resolve({ data: [], error: null } as any),
          ownerIds.length
            ? supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);
        const petMap = new Map((petsRes.data ?? []).map((p: any) => [p.id, p.name]));
        const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.user_id, p.full_name]));
        setTickets(tix.map((t) => ({
          ...t,
          pet_name: petMap.get(t.pet_id) as string | undefined,
          owner_name: profMap.get(t.owner_id) as string | undefined,
        })));
      }
      setLoading(false);
    });
  }, [user]);

  const openFile = async (path: string) => {
    try {
      const url = await getTicketFileSignedUrl(path);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to open file");
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateAppointmentStatus(id, status);
      toast.success(`Appointment ${status}`);
      if (vetId) fetchVetAppointments(vetId).then(setAppointments);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="animate-pulse text-muted-foreground">Loading...</div>;

  const upcoming = appointments.filter((a) => a.status === "confirmed" || a.status === "pending");
  const completed = appointments.filter((a) => a.status === "completed").length;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-accent/10 text-accent",
    completed: "bg-primary/10 text-primary",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Vet Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your appointments and patients</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{upcoming.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
            <Stethoscope className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{services.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No appointments yet.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {(a as any).pets?.name || "Unknown Pet"} — {(a as any).profiles?.full_name || "Unknown Owner"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.scheduled_at).toLocaleString()}
                        {(a as any).services?.name && ` · ${(a as any).services.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[a.status] || ""} variant="secondary">{a.status}</Badge>
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-accent" onClick={() => handleStatus(a.id, "confirmed")}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleStatus(a.id, "cancelled")}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {a.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatus(a.id, "completed")}>
                        Complete
                      </Button>
                    )}
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
