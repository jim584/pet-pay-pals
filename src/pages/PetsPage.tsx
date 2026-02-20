import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pet, fetchPets, deletePet } from "@/lib/pets-api";
import { PetFormDialog } from "@/components/pets/PetFormDialog";
import { PetDetail } from "@/components/pets/PetDetail";
import { toast } from "@/components/ui/sonner";
import { Plus, PawPrint, Trash2 } from "lucide-react";

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPet, setEditPet] = useState<Pet | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

  const loadPets = async () => {
    setLoading(true);
    try {
      const data = await fetchPets();
      setPets(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPets(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deletePet(id);
      toast.success("Pet removed");
      if (selectedPet?.id === id) setSelectedPet(null);
      loadPets();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (selectedPet) {
    return (
      <PetDetail
        pet={selectedPet}
        onBack={() => setSelectedPet(null)}
        onEdit={() => { setEditPet(selectedPet); setShowForm(true); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">My Pets</h1>
          <p className="text-muted-foreground mt-1">Manage your pet profiles</p>
        </div>
        <Button onClick={() => { setEditPet(null); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add Pet
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading pets...</div>
      ) : pets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <PawPrint className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">No pets yet. Add your first furry friend!</p>
            <Button onClick={() => { setEditPet(null); setShowForm(true); }}>Add Pet</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <Card
              key={pet.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:ring-1 hover:ring-primary/20"
              onClick={() => setSelectedPet(pet)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <PawPrint className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold font-display">{pet.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive/60 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(pet.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  {pet.age_years && <span>{pet.age_years} yr{pet.age_years > 1 ? "s" : ""}</span>}
                  {pet.weight_kg && <span>{pet.weight_kg} kg</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PetFormDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditPet(null); }}
        pet={editPet}
        onSuccess={() => {
          loadPets();
          if (editPet && selectedPet?.id === editPet.id) {
            fetchPets().then((p) => setSelectedPet(p.find((x) => x.id === editPet.id) ?? null));
          }
        }}
      />
    </div>
  );
}
