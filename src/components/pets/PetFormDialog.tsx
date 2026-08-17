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
import { fetchApprovedVetsForPicker, type VetPickerOption } from "@/lib/vet-api";
import { getLicenseRecord, type VetLicenseRecord } from "@/lib/vet-licenses-api";
import { LicensedVetPicker } from "@/components/pets/LicensedVetPicker";
import { supabase } from "@/integrations/supabase/client";
import { isValidImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/utils";
import { Camera, PawPrint, X, CalendarIcon, BadgeCheck, AlertCircle } from "lucide-react";
import { ImageCropDialog } from "@/components/ui/ImageCropDialog";
import { getBreedsForSpecies } from "@/lib/breeds";
import { BreedCombobox } from "@/components/pets/BreedCombobox";
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
  const parseMixedBreed = (breed: string | null | undefined) => {
    if (breed?.startsWith("Mixed Breed - ")) return { breed: "Mixed Breed", detail: breed.slice(14) };
    return { breed: breed ?? "", detail: "" };
  };
  const parsed = parseMixedBreed(pet?.breed);
  const [form, setForm] = useState({
    name: pet?.name ?? "",
    species: pet?.species ?? "dog",
    breed: parsed.breed,
    mixedBreedDetail: parsed.detail,
    date_of_birth: pet?.date_of_birth ? new Date(pet.date_of_birth + "T00:00:00") : undefined as Date | undefined,
    weight_kg: pet?.weight_kg?.toString() ?? "",
    gender: pet?.gender ?? "",
    notes: pet?.notes ?? "",
    vet_of_record_id: pet?.vet_of_record_id ?? "",
  });
  const [vetOptions, setVetOptions] = useState<VetPickerOption[]>([]);
  const [licenseVet, setLicenseVet] = useState<VetLicenseRecord | null>(null);

  useEffect(() => {
    fetchApprovedVetsForPicker().then(setVetOptions).catch(() => setVetOptions([]));
  }, []);

  useEffect(() => {
    const id = (pet as { vet_of_record_license_id?: string | null } | undefined)?.vet_of_record_license_id;
    if (!open) return;
    if (!id) { setLicenseVet(null); return; }
    getLicenseRecord(id).then(setLicenseVet).catch(() => setLicenseVet(null));
  }, [open, pet]);

  // Crop state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  useEffect(() => {
    if (open) {
      const p = parseMixedBreed(pet?.breed);
      setForm({
        name: pet?.name ?? "",
        species: pet?.species ?? "dog",
        breed: p.breed,
        mixedBreedDetail: p.detail,
        date_of_birth: pet?.date_of_birth ? new Date(pet.date_of_birth + "T00:00:00") : undefined,
        weight_kg: pet?.weight_kg?.toString() ?? "",
        gender: pet?.gender ?? "",
        notes: pet?.notes ?? "",
        vet_of_record_id: pet?.vet_of_record_id ?? "",
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
    // Photo is required: either an existing photo (edit) or a newly selected file.
    const hasExistingPhoto = !removePhoto && !!pet?.photo_url;
    if (!photoFile && !hasExistingPhoto) {
      toast.error("Photo required", { description: "Please add a photo of your pet to continue." });
      return;
    }
    setSubmitting(true);
    try {
      const dobStr = form.date_of_birth ? format(form.date_of_birth, "yyyy-MM-dd") : null;
      const computedAge = dobStr ? calculateAge(dobStr).years : null;
      const finalBreed = form.breed === "Mixed Breed" && form.mixedBreedDetail?.trim()
        ? `Mixed Breed - ${form.mixedBreedDetail.trim()}`
        : form.breed || null;
      const payload = {
        name: form.name,
        species: form.species,
        breed: finalBreed,
        date_of_birth: dobStr,
        age_years: computedAge,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        gender: form.gender || null,
        notes: form.notes || null,
        owner_id: user.id,
        photo_url: removePhoto ? null : (pet?.photo_url ?? null),
        vet_of_record_id: form.vet_of_record_id || null,
        vet_of_record_set_at: form.vet_of_record_id && form.vet_of_record_id !== (pet?.vet_of_record_id ?? "")
          ? new Date().toISOString()
          : (pet?.vet_of_record_set_at ?? null),
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
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-primary/20">
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
              <p className="text-xs text-muted-foreground">Click to upload photo (required)</p>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Species</Label>
                <Select value={form.species} onValueChange={(v) => setForm({ ...form, species: v, breed: "", mixedBreedDetail: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="horse">Horse</SelectItem>
                    <SelectItem value="bird">Bird</SelectItem>
                    <SelectItem value="rabbit">Rabbit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Breed</Label>
                {getBreedsForSpecies(form.species).length > 0 ? (
                  <BreedCombobox
                    breeds={getBreedsForSpecies(form.species)}
                    value={form.breed}
                    onChange={(v) => setForm({ ...form, breed: v, mixedBreedDetail: v === "Mixed Breed" ? form.mixedBreedDetail : "" })}
                    mixedBreedDetail={form.mixedBreedDetail}
                    onMixedBreedDetailChange={(d) => setForm({ ...form, mixedBreedDetail: d })}
                  />
                ) : (
                  <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.date_of_birth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.date_of_birth ? format(form.date_of_birth, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.date_of_birth}
                      onSelect={(date) => setForm({ ...form, date_of_birth: date || undefined })}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {form.date_of_birth && (
                  <p className="text-xs text-muted-foreground">
                    Age: {(() => {
                      const { years, months } = calculateAge(format(form.date_of_birth, "yyyy-MM-dd"));
                      if (years === 0) return `${months} month${months !== 1 ? "s" : ""}`;
                      return `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}`;
                    })()}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Weight (lbs)</Label>
                <Input type="number" min="0" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Primary vet (Vet of Record)</Label>
              <Select
                value={form.vet_of_record_id || "none"}
                onValueChange={(v) => setForm({ ...form, vet_of_record_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select your pet's primary vet" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vetOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.clinic_name}
                      {v.location ? ` — ${v.location}` : ""}
                      {v.fear_free_certified ? " · Fear Free" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.vet_of_record_id ? (
                <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Optional, but adding a Vet of Record unlocks Fear Free pricing if your vet is certified.</span>
                </p>
              ) : (
                (() => {
                  const sel = vetOptions.find((v) => v.id === form.vet_of_record_id);
                  if (sel?.fear_free_certified) {
                    return (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Fear Free certified — you qualify for Fear Free member pricing.
                      </p>
                    );
                  }
                  return null;
                })()
              )}
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
