import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { createEmergencyContact, updateEmergencyContact, EmergencyContact } from "@/lib/pets-api";

interface AddEmergencyContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  onSuccess: () => void;
  contact?: EmergencyContact | null;
}

export function AddEmergencyContactDialog({ open, onOpenChange, petId, onSuccess, contact }: AddEmergencyContactDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ contact_name: "", phone: "", relationship: "" });

  useEffect(() => {
    if (open) {
      setForm({
        contact_name: contact?.contact_name ?? "",
        phone: contact?.phone ?? "",
        relationship: contact?.relationship ?? "",
      });
    }
  }, [open, contact]);

  const isEditing = !!contact;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        contact_name: form.contact_name,
        phone: form.phone,
        relationship: form.relationship || null,
      };
      if (isEditing) {
        await updateEmergencyContact(contact.id, payload);
        toast.success("Emergency contact updated!");
      } else {
        await createEmergencyContact({ ...payload, pet_id: petId });
        toast.success("Emergency contact added!");
      }
      onSuccess();
      onOpenChange(false);
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
          <DialogTitle>{isEditing ? "Edit Emergency Contact" : "Add Emergency Contact"}</DialogTitle>
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
            {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
