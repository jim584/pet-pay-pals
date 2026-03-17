import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { fetchPets, Pet } from "@/lib/pets-api";
import { createStory, uploadStoryPhoto, STORY_CATEGORIES } from "@/lib/community-api";
import { ImagePlus, X, AlertTriangle } from "lucide-react";
import { isValidImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageCropDialog } from "@/components/ui/ImageCropDialog";

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultCategory?: string;
}

export function CreateStoryDialog({ open, onOpenChange, onSuccess, defaultCategory }: CreateStoryDialogProps) {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ pet_id: "", title: "", content: "", category: defaultCategory || "general", is_urgent: false });

  // Crop state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (open) fetchPets().then(setPets).catch(() => {});
  }, [open]);

  const handlePhotos = (files: FileList | null) => {
    if (!files) return;
    const validFiles = Array.from(files)
      .filter((f) => {
        if (!isValidImageFile(f)) {
          toast.error(`"${f.name}" is not a supported format. Use JPG, PNG, WebP, or GIF.`);
          return false;
        }
        return true;
      })
      .slice(0, 4 - photos.length);
    if (validFiles.length === 0) return;
    // Queue files for sequential cropping
    setPendingFiles(validFiles.slice(1));
    openCropper(validFiles[0]);
  };

  const openCropper = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImageSrc(e.target?.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (croppedFile: File, previewUrl: string) => {
    setPhotos((prev) => [...prev, croppedFile]);
    setPreviews((prev) => [...prev, previewUrl]);
    setCropOpen(false);
    setCropImageSrc("");
    // Process next pending file
    setPendingFiles((prev) => {
      const remaining = [...prev];
      const next = remaining.shift();
      if (next) {
        setTimeout(() => openCropper(next), 150);
        return remaining;
      }
      return [];
    });
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropImageSrc("");
    setPendingFiles([]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const url = await uploadStoryPhoto(user.id, photo);
        photoUrls.push(url);
      }
      await createStory({
        pet_id: form.pet_id,
        author_id: user.id,
        title: form.title,
        content: form.content,
        photo_urls: photoUrls,
        category: form.category,
        is_urgent: form.is_urgent,
      });
      toast.success("Story shared!");
      onSuccess();
      onOpenChange(false);
      setForm({ pet_id: "", title: "", content: "", category: defaultCategory || "general", is_urgent: false });
      setPhotos([]);
      setPreviews([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share a Pet Story</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Which pet?</Label>
              <Select value={form.pet_id} onValueChange={(v) => setForm({ ...form, pet_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a pet" /></SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {STORY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Max's surgery recovery" />
            </div>
            <div className="space-y-2">
              <Label>Story *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required rows={4} placeholder="Tell the community about your pet..." />
            </div>
            <div className="space-y-2">
              <Label>Photos (up to 4)</Label>
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={src} className="w-full h-full object-cover" alt="" />
                    <button type="button" className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5" onClick={() => removePhoto(i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button
                    type="button"
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="hidden" onChange={(e) => { handlePhotos(e.target.files); e.target.value = ""; }} />
            </div>
            {form.category === "protection" && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <Checkbox
                  id="is_urgent"
                  checked={form.is_urgent}
                  onCheckedChange={(checked) => setForm({ ...form, is_urgent: !!checked })}
                />
                <label htmlFor="is_urgent" className="flex items-center gap-1.5 text-sm font-medium text-destructive cursor-pointer">
                  <AlertTriangle className="h-4 w-4" />
                  Mark as urgent / critical case
                </label>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting || !form.pet_id}>
              {submitting ? "Sharing..." : "Share Story"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        aspectRatio={4 / 3}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </>
  );
}
