import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { createHealthRecord } from "@/lib/pets-api";

interface AddHealthRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  onSuccess: () => void;
}

export function AddHealthRecordDialog({ open, onOpenChange, petId, onSuccess }: AddHealthRecordDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    record_type: "general",
    description: "",
    record_date: new Date().toISOString().split("T")[0],
    vet_name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createHealthRecord({
        pet_id: petId,
        title: form.title,
        record_type: form.record_type,
        description: form.description || null,
        record_date: form.record_date,
        vet_name: form.vet_name || null,
      });
      toast.success("Health record added!");
      onSuccess();
      onOpenChange(false);
      setForm({ title: "", record_type: "general", description: "", record_date: new Date().toISOString().split("T")[0], vet_name: "" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Health Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Annual vaccination" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="vaccination">Vaccination</SelectItem>
                  <SelectItem value="surgery">Surgery</SelectItem>
                  <SelectItem value="checkup">Checkup</SelectItem>
                  <SelectItem value="allergy">Allergy</SelectItem>
                  <SelectItem value="medication">Medication</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vet Name</Label>
            <Input value={form.vet_name} onChange={(e) => setForm({ ...form, vet_name: e.target.value })} placeholder="Dr. Smith" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving..." : "Add Record"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
