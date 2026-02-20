import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { fetchVetProfile, fetchVetServices, createVetService, deleteVetService, VetService } from "@/lib/vet-api";
import { Plus, Trash2, DollarSign, Clock } from "lucide-react";

export function VetServicesPage() {
  const { user } = useAuth();
  const [vetId, setVetId] = useState<string | null>(null);
  const [services, setServices] = useState<VetService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", duration_minutes: "30" });

  useEffect(() => {
    if (!user) return;
    fetchVetProfile(user.id).then((p) => {
      if (p) {
        setVetId(p.id);
        fetchVetServices(p.id).then(setServices);
      }
      setLoading(false);
    });
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vetId) return;
    setSubmitting(true);
    try {
      await createVetService({
        vet_id: vetId,
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        duration_minutes: parseInt(form.duration_minutes) || 30,
      });
      toast.success("Service added!");
      setShowAdd(false);
      setForm({ name: "", description: "", price: "", duration_minutes: "30" });
      fetchVetServices(vetId).then(setServices);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVetService(id);
      toast.success("Service removed");
      if (vetId) fetchVetServices(vetId).then(setServices);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="animate-pulse text-muted-foreground">Loading...</div>;
  if (!vetId) return <p className="text-muted-foreground">Please set up your vet profile first.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">My Services</h1>
          <p className="text-muted-foreground mt-1">Manage your offered services and pricing</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No services yet. Add your first service!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold font-display">{s.name}</p>
                    {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                    <div className="flex gap-3 mt-3 text-sm">
                      <Badge variant="secondary" className="gap-1">
                        <DollarSign className="h-3 w-3" />${Number(s.price).toFixed(2)}
                      </Badge>
                      {s.duration_minutes && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />{s.duration_minutes} min
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="General Checkup" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ($) *</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Adding..." : "Add Service"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
