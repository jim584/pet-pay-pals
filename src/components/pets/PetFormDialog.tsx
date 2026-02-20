import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { createPet, updatePet, Pet } from "@/lib/pets-api";

interface PetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pet?: Pet | null;
  onSuccess: () => void;
}

export function PetFormDialog({ open, onOpenChange, pet, onSuccess }: PetFormDialogProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: pet?.name ?? "",
    species: pet?.species ?? "dog",
    breed: pet?.breed ?? "",
    age_years: pet?.age_years?.toString() ?? "",
    weight_kg: pet?.weight_kg?.toString() ?? "",
    notes: pet?.notes ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        species: form.species,
        breed: form.breed || null,
        age_years: form.age_years ? parseInt(form.age_years) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        notes: form.notes || null,
        owner_id: user.id,
        photo_url: pet?.photo_url ?? null,
      };
      if (pet) {
        await updatePet(pet.id, payload);
        toast.success("Pet updated!");
      } else {
        await createPet(payload);
        toast.success("Pet added!");
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
          <DialogTitle>{pet ? "Edit Pet" : "Add New Pet"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Species</Label>
              <Select value={form.species} onValueChange={(v) => setForm({ ...form, species: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Dog</SelectItem>
                  <SelectItem value="cat">Cat</SelectItem>
                  <SelectItem value="bird">Bird</SelectItem>
                  <SelectItem value="rabbit">Rabbit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Breed</Label>
              <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Age (years)</Label>
              <Input type="number" min="0" value={form.age_years} onChange={(e) => setForm({ ...form, age_years: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" min="0" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving..." : pet ? "Save Changes" : "Add Pet"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
