import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSuggestedPets, followPet, checkFollowing, type SuggestedPet } from "@/lib/feed-api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PawPrint } from "lucide-react";

export function MobileSuggestedPets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());

  const { data: pets = [] } = useQuery({
    queryKey: ["suggestedPets"],
    queryFn: () => fetchSuggestedPets(user?.id),
    retry: false,
    staleTime: 60_000,
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

  const visiblePets = pets.filter((p) => !followedSet.has(p.id)).slice(0, 10);

  if (visiblePets.length === 0) return null;

  return (
    <div className="mb-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Suggested Pets
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
        {visiblePets.map((pet) => (
          <div
            key={pet.id}
            className="flex flex-col items-center gap-1.5 min-w-[80px] shrink-0"
          >
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              <AvatarImage src={pet.photo_url ?? undefined} />
              <AvatarFallback><PawPrint className="h-5 w-5" /></AvatarFallback>
            </Avatar>
            <p className="text-xs font-medium text-foreground truncate w-full text-center">
              {pet.name}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2.5 rounded-full"
              onClick={() => {
                if (!user) { navigate("/auth"); return; }
                followMutation.mutate(pet.id);
              }}
            >
              Follow
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
