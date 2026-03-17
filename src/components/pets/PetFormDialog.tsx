import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { createPet, updatePet, Pet, calculateAge } from "@/lib/pets-api";
import { supabase } from "@/integrations/supabase/client";
import { isValidImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/utils";
import { Camera, PawPrint, X, CalendarIcon } from "lucide-react";
import { ImageCropDialog } from "@/components/ui/ImageCropDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pet?: Pet | null;
  onSuccess: () => void;
}

export function PetFormDialog({ open, onOpenChange, pet, onSuccess }: PetFormDialogProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(pet?.photo_url ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: pet?.name ?? "",
    species: pet?.species ?? "dog",
    breed: pet?.breed ?? "",
    date_of_birth: pet?.date_of_birth ? new Date(pet.date_of_birth + "T00:00:00") : undefined as Date | undefined,
    weight_kg: pet?.weight_kg?.toString() ?? "",
    notes: pet?.notes ?? "",
  });

  // Crop state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        name: pet?.name ?? "",
        species: pet?.species ?? "dog",
        breed: pet?.breed ?? "",
        date_of_birth: pet?.date_of_birth ? new Date(pet.date_of_birth + "T00:00:00") : undefined,
        weight_kg: pet?.weight_kg?.toString() ?? "",
        notes: pet?.notes ?? "",
      });
      setPhotoPreview(pet?.photo_url ?? null);
      setPhotoFile(null);
      setRemovePhoto(false);
    }
  }, [open, pet]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      toast.error("Unsupported format. Use JPG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    // Open cropper instead of directly setting
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropImageSrc(ev.target?.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropConfirm = (croppedFile: File, previewUrl: string) => {
    setPhotoFile(croppedFile);
    setPhotoPreview(previewUrl);
    setRemovePhoto(false);
    setCropOpen(false);
    setCropImageSrc("");
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropImageSrc("");
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
  };

  const uploadPhoto = async (petId: string): Promise<string | null> => {
    if (!photoFile || !user) return pet?.photo_url ?? null;
    const ext = photoFile.name.split(".").pop();
    const path = `${user.id}/${petId}.${ext}`;
    const { error } = await supabase.storage
      .from("pet-photos")
      .upload(path, photoFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

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
        photo_url: removePhoto ? null : (pet?.photo_url ?? null),
      };
      let savedPet: Pet;
      if (pet) {
        savedPet = await updatePet(pet.id, payload);
      } else {
        savedPet = await createPet(payload);
      }
      if (photoFile) {
        const photoUrl = await uploadPhoto(savedPet.id);
        if (photoUrl) {
          await updatePet(savedPet.id, { photo_url: photoUrl });
        }
      }
      toast.success(pet ? "Pet updated!" : "Pet added!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pet ? "Edit Pet" : "Add New Pet"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-1">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="h-20 w-20 border-2 border-primary/20">
                  <AvatarImage src={photoPreview ?? undefined} alt="Pet photo" />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <PawPrint className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
              <p className="text-xs text-muted-foreground">Click to upload photo</p>
            </div>
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
                <Label>Weight (lbs)</Label>
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
      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        aspectRatio={1}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </>
  );
}
