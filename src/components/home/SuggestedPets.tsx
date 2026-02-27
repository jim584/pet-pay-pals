import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSuggestedPets, followPet, checkFollowing, type SuggestedPet } from "@/lib/feed-api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PetProfilePreview } from "./PetProfilePreview";
import { PawPrint } from "lucide-react";

export function SuggestedPets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());

  const { data: pets = [] } = useQuery({
    queryKey: ["suggestedPets"],
    queryFn: () => fetchSuggestedPets(user?.id),
  });

  useEffect(() => {
    if (!user || pets.length === 0) return;
    checkFollowing(pets.map((p) => p.id), user.id).then(setFollowedSet);
  }, [user, pets]);

  const followMutation = useMutation({
    mutationFn: async (petId: string) => {
      if (!user) return;
      await followPet(petId, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestedPets"] });
      qc.invalidateQueries({ queryKey: ["publicFeed"] });
      if (user && pets.length) {
        checkFollowing(pets.map((p) => p.id), user.id).then(setFollowedSet);
      }
    },
  });

  const visiblePets = pets.filter((p) => !followedSet.has(p.id)).slice(0, 5);

  if (visiblePets.length === 0) return null;

  return (
    <div className="py-4">
      <h3 className="px-4 mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Suggested Pets
      </h3>
      <div className="space-y-1">
        {visiblePets.map((pet) => (
          <div key={pet.id} className="flex items-center gap-3 px-4 py-2">
            <PetProfilePreview
              petName={pet.name}
              petPhoto={pet.photo_url}
              species={pet.species}
              breed={pet.breed}
              followersCount={pet.followers_count}
            >
              <button className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={pet.photo_url ?? undefined} />
                  <AvatarFallback><PawPrint className="h-3.5 w-3.5" /></AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{pet.name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{pet.breed || pet.species}</p>
                </div>
              </button>
            </PetProfilePreview>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-xs text-primary hover:text-primary shrink-0"
                  onClick={() => {
                    if (!user) { navigate("/auth"); return; }
                    followMutation.mutate(pet.id);
                  }}
                >
                  Follow
                </Button>
              </TooltipTrigger>
              {!user && <TooltipContent>Sign up to follow pets!</TooltipContent>}
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
}
