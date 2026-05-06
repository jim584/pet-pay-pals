import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Heart, PawPrint, ShieldCheck, Plus, Pencil, Trash2, HandHeart, Stethoscope, UtensilsCrossed } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSponsorshipPets,
  createSponsorshipPet,
  updateSponsorshipPet,
  deleteSponsorshipPet,
  startDonationCheckout,
  type SponsorshipPet,
} from "@/lib/overcome-api";

// ── Helpers ──
const statusLabel = (s: string) =>
  s === "sponsored" ? "Fully Sponsored" : s === "partially_sponsored" ? "Partially Sponsored" : "Needs Sponsor";
const statusVariant = (s: string): "default" | "secondary" | "destructive" =>
  s === "sponsored" ? "default" : s === "partially_sponsored" ? "secondary" : "destructive";

// ── Main Page ──
export default function HelpOvercomePage() {
  const isMobile = useIsMobile();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "dog" | "cat">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editPet, setEditPet] = useState<SponsorshipPet | null>(null);
  const [deletePet, setDeletePet] = useState<SponsorshipPet | null>(null);
  const [sponsorPet, setSponsorPet] = useState<SponsorshipPet | null>(null);

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ["sponsorship-pets"],
    queryFn: fetchSponsorshipPets,
  });

  const filtered = filter === "all" ? pets : pets.filter((p) => p.species === filter);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center h-14 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-2 ml-3">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold font-display text-foreground">Help A Pet Overcome™</span>
            {isAdmin && (
              <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary">
                <ShieldCheck className="h-3 w-3" /> Admin
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto ${isMobile ? "px-3 py-4 pb-24" : "px-6 py-8"}`}>
        {/* ── Section 1: Hero ── */}
        <section className="rounded-xl bg-primary/5 border border-primary/20 p-6 mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Help a Pet Overcome</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl mx-auto">
            Many pets need extra care to overcome illness, injury, or neglect. By sponsoring a pet, you directly fund their
            veterinary treatment, nutrition, shelter, and the love they deserve on their road to recovery.
          </p>
        </section>

        {/* ── Section 2: How It Works ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold font-display text-foreground text-center mb-5">How Sponsorship Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: PawPrint, title: "Choose a Pet", desc: "Browse pets who need your help and pick one that touches your heart." },
              { icon: HandHeart, title: "Sponsor", desc: "Contribute any amount — every dollar goes directly toward their care." },
              { icon: Stethoscope, title: "Pet Gets Care", desc: "Your funds cover vet visits, medicine, food, and a safe shelter." },
            ].map((step) => (
              <Card key={step.title} className="text-center">
                <CardContent className="pt-6">
                  <step.icon className="h-8 w-8 mx-auto text-primary mb-3" />
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Section 3: Pet Listings ── */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-bold font-display text-foreground">Pets Available for Sponsorship</h2>
            {isAdmin && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Pet
              </Button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-5">
            {(["all", "dog", "cat"] as const).map((f) => (
              <Badge
                key={f}
                variant={filter === f ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "dog" ? "Dogs" : "Cats"}
              </Badge>
            ))}
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-12">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No pets found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((pet) => (
                <PetSponsorCard
                  key={pet.id}
                  pet={pet}
                  isAdmin={isAdmin}
                  onSponsor={() => setSponsorPet(pet)}
                  onEdit={() => setEditPet(pet)}
                  onDelete={() => setDeletePet(pet)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Dialogs */}
      {addOpen && <AddEditPetDialog open onClose={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["sponsorship-pets"] }); }} userId={user?.id} />}
      {editPet && <AddEditPetDialog open pet={editPet} onClose={() => { setEditPet(null); qc.invalidateQueries({ queryKey: ["sponsorship-pets"] }); }} userId={user?.id} />}
      {deletePet && <DeletePetDialog pet={deletePet} onClose={() => { setDeletePet(null); qc.invalidateQueries({ queryKey: ["sponsorship-pets"] }); }} />}
      {sponsorPet && <SponsorDialog pet={sponsorPet} userId={user?.id} onClose={() => { setSponsorPet(null); qc.invalidateQueries({ queryKey: ["sponsorship-pets"] }); }} />}
    </div>
  );
}

// ── Pet Card ──
function PetSponsorCard({ pet, isAdmin, onSponsor, onEdit, onDelete }: {
  pet: SponsorshipPet; isAdmin: boolean; onSponsor: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const pct = pet.sponsorship_goal > 0 ? Math.min((pet.sponsorship_raised / pet.sponsorship_goal) * 100, 100) : 0;
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="aspect-[4/3] bg-muted relative">
        {pet.photo_url ? (
          <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><PawPrint className="h-12 w-12 text-muted-foreground/40" /></div>
        )}
        <Badge className="absolute top-2 right-2 capitalize" variant="secondary">{pet.species}</Badge>
      </div>
      <CardContent className="pt-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground text-lg leading-tight">{pet.name}</h3>
          <Badge variant={statusVariant(pet.sponsorship_status)} className="text-[10px] shrink-0 ml-2">
            {statusLabel(pet.sponsorship_status)}
          </Badge>
        </div>
        {pet.description && <p className="text-muted-foreground text-sm line-clamp-2">{pet.description}</p>}
        {pet.condition_details && <p className="text-xs text-muted-foreground italic line-clamp-1">{pet.condition_details}</p>}

        {/* Progress */}
        <div className="mt-auto pt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>${pet.sponsorship_raised.toLocaleString()} raised</span>
            <span>Goal: ${pet.sponsorship_goal.toLocaleString()}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="flex gap-2 mt-2">
          <Button size="sm" className="flex-1" onClick={onSponsor} disabled={pet.sponsorship_status === "sponsored"}>
            <Heart className="h-4 w-4 mr-1" /> Sponsor Now
          </Button>
          {isAdmin && (
            <>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Add / Edit Dialog ──
function AddEditPetDialog({ open, pet, onClose, userId }: {
  open: boolean; pet?: SponsorshipPet; onClose: () => void; userId?: string;
}) {
  const isEdit = !!pet;
  const [name, setName] = useState(pet?.name ?? "");
  const [species, setSpecies] = useState(pet?.species ?? "dog");
  const [description, setDescription] = useState(pet?.description ?? "");
  const [condition, setCondition] = useState(pet?.condition_details ?? "");
  const [goal, setGoal] = useState(String(pet?.sponsorship_goal ?? ""));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !goal) return;
    setSaving(true);
    try {
      let photo_url = pet?.photo_url ?? undefined;
      if (photoFile) {
        const path = `overcome/${Date.now()}_${photoFile.name}`;
        const { error: upErr } = await supabase.storage.from("behave-media").upload(path, photoFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("behave-media").getPublicUrl(path);
        photo_url = urlData.publicUrl;
      }
      if (isEdit && pet) {
        await updateSponsorshipPet(pet.id, { name, species, description, condition_details: condition, sponsorship_goal: Number(goal), photo_url });
      } else {
        await createSponsorshipPet({ name, species, description, condition_details: condition, sponsorship_goal: Number(goal), photo_url, added_by: userId! });
      }
      toast({ title: isEdit ? "Pet updated" : "Pet added" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Pet" : "Add Pet for Sponsorship"}</DialogTitle>
          <DialogDescription>Fill in the details below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Species</Label>
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dog">Dog</SelectItem>
                <SelectItem value="cat">Cat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Condition / Needs</Label><Textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={2} /></div>
          <div><Label>Sponsorship Goal ($)</Label><Input type="number" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
          <div><Label>Photo</Label><Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Saving…" : isEdit ? "Update" : "Add Pet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Dialog ──
function DeletePetDialog({ pet, onClose }: { pet: SponsorshipPet; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSponsorshipPet(pet.id);
      toast({ title: "Pet removed" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {pet.name}?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently remove this pet and all related donations.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Sponsor Dialog ──
function SponsorDialog({ pet, userId, onClose }: { pet: SponsorshipPet; userId?: string; onClose: () => void }) {
  const presets = [10, 25, 50, 100];
  const [amount, setAmount] = useState<number | "">(25);
  const [customAmt, setCustomAmt] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isCustom = !presets.includes(amount as number);

  const finalAmount = isCustom ? Number(customAmt) : (amount as number);

  const handleSubmit = async () => {
    if (!finalAmount || finalAmount <= 0) return;
    setSubmitting(true);
    try {
      const url = await startDonationCheckout({
        pet_id: pet.id,
        amount: finalAmount,
        donor_name: donorName || undefined,
        donor_email: donorEmail || undefined,
        message: message || undefined,
      });
      window.location.href = url;
    } catch (e: any) {
      toast({ title: "Couldn't start checkout", description: e.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sponsor {pet.name}</DialogTitle>
          <DialogDescription>Your contribution funds veterinary care, food, and shelter.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Amount presets */}
          <div>
            <Label>Select Amount</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {presets.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={amount === p ? "default" : "outline"}
                  onClick={() => { setAmount(p); setCustomAmt(""); }}
                >
                  ${p}
                </Button>
              ))}
              <Button
                size="sm"
                variant={isCustom ? "default" : "outline"}
                onClick={() => setAmount("")}
              >
                Custom
              </Button>
            </div>
            {isCustom && (
              <Input
                type="number"
                min="1"
                placeholder="Enter amount"
                className="mt-2"
                value={customAmt}
                onChange={(e) => setCustomAmt(e.target.value)}
              />
            )}
          </div>
          <div><Label>Your Name (optional)</Label><Input value={donorName} onChange={(e) => setDonorName(e.target.value)} /></div>
          <div><Label>Email (optional)</Label><Input type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} /></div>
          <div><Label>Message (optional)</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={submitting || !finalAmount || finalAmount <= 0}>
            {submitting ? "Processing…" : `Donate $${finalAmount || 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
