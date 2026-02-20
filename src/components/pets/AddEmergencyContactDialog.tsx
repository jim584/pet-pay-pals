import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { createEmergencyContact } from "@/lib/pets-api";

interface AddEmergencyContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  onSuccess: () => void;
}

export function AddEmergencyContactDialog({ open, onOpenChange, petId, onSuccess }: AddEmergencyContactDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ contact_name: "", phone: "", relationship: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createEmergencyContact({
        pet_id: petId,
        contact_name: form.contact_name,
        phone: form.phone,
        relationship: form.relationship || null,
      });
      toast.success("Emergency contact added!");
      onSuccess();
      onOpenChange(false);
      setForm({ contact_name: "", phone: "", relationship: "" });
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
          <DialogTitle>Add Emergency Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Contact Name *</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+1 555-0123" />
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="e.g. Neighbor, Family" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving..." : "Add Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
