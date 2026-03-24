import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Loader2, CalendarIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createAdoptionListing, uploadAdoptionPhoto } from "@/lib/adoption-api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateAge } from "@/lib/pets-api";
import { getBreedsForSpecies } from "@/lib/breeds";
import { BreedCombobox } from "@/components/pets/BreedCombobox";

export function CreateAdoptionDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    pet_name: "",
    species: "dog",
    breed: "",
    mixedBreedDetail: "",
    age_text: "",
    gender: "",
    description: "",
    shelter_name: "",
    shelter_location: "",
    contact_phone: "",
    contact_email: "",
    contact_website: "",
  });
  const [dob, setDob] = useState<Date | undefined>();
  const [photos, setPhotos] = useState<File[]>([]);

  const computedAgeText = dob
    ? (() => {
        const { years, months } = calculateAge(format(dob, "yyyy-MM-dd"));
        if (years === 0) return `${months} month${months !== 1 ? "s" : ""}`;
        return `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}`;
      })()
    : "";

  const set = (key: string, value: string) => setForm((f) => ({
    ...f,
    [key]: value,
    ...(key === "species" ? { breed: "", mixedBreedDetail: "" } : {}),
    ...(key === "breed" && value !== "Mixed Breed" ? { mixedBreedDetail: "" } : {}),
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.pet_name.trim() || !form.shelter_name.trim()) {
      toast({ title: "Pet name and shelter name are required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let photo_urls: string[] = [];
      for (const photo of photos) {
        const url = await uploadAdoptionPhoto(photo);
        photo_urls.push(url);
      }

      const finalBreed = form.breed === "Mixed Breed" && form.mixedBreedDetail?.trim()
        ? `Mixed Breed - ${form.mixedBreedDetail.trim()}`
        : form.breed || null;
      await createAdoptionListing({
        pet_name: form.pet_name,
        species: form.species,
        breed: finalBreed,
        age_text: dob ? computedAgeText : (form.age_text || null),
        gender: form.gender || null,
        description: form.description || null,
        photo_urls,
        shelter_name: form.shelter_name,
        shelter_location: form.shelter_location || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        contact_website: form.contact_website || null,
        posted_by: user.id,
      });

      toast({ title: "Adoption listing posted!" });
      queryClient.invalidateQueries({ queryKey: ["adoption-listings"] });
      setOpen(false);
      setForm({ pet_name: "", species: "dog", breed: "", mixedBreedDetail: "", age_text: "", gender: "", description: "", shelter_name: "", shelter_location: "", contact_phone: "", contact_email: "", contact_website: "" });
      setDob(undefined);
      setPhotos([]);
    } catch (err: any) {
      toast({ title: "Error posting listing", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Post Adoption Listing</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a Pet for Adoption</DialogTitle>
          <DialogDescription>Fill in the details about the pet available for adoption.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pet info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pet Name *</Label>
              <Input value={form.pet_name} onChange={(e) => set("pet_name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Species</Label>
              <Select value={form.species} onValueChange={(v) => set("species", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Dog</SelectItem>
                  <SelectItem value="cat">Cat</SelectItem>
                  <SelectItem value="horse">Horse</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Breed</Label>
              {getBreedsForSpecies(form.species).length > 0 ? (
                <BreedCombobox
                  breeds={getBreedsForSpecies(form.species)}
                  value={form.breed}
                  onChange={(v) => set("breed", v)}
                />
              ) : (
                <Input value={form.breed} onChange={(e) => set("breed", e.target.value)} placeholder="e.g. Breed name" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dob && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dob ? format(dob, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dob}
                    onSelect={setDob}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {dob && (
                <p className="text-xs text-muted-foreground">Age: {computedAgeText}</p>
              )}
              {!dob && (
                <Input value={form.age_text} onChange={(e) => set("age_text", e.target.value)} placeholder="Or type e.g. 2 years" className="mt-1.5" />
              )}
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Tell people about this pet..." />
          </div>

          {/* Photos */}
          <div className="space-y-1.5">
            <Label>Photos</Label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground border border-dashed rounded-md p-3 hover:border-primary/50 transition-colors">
              <Upload className="h-4 w-4" />
              {photos.length ? `${photos.length} photo(s) selected` : "Upload photos"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
            </label>
          </div>

          {/* Shelter info */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Shelter / Contact Info</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shelter Name *</Label>
                <Input value={form.shelter_name} onChange={(e) => set("shelter_name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.shelter_location} onChange={(e) => set("shelter_location", e.target.value)} placeholder="City, State" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+1 555 000 0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} type="email" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Website</Label>
                <Input value={form.contact_website} onChange={(e) => set("contact_website", e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Post Listing
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
