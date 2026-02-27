import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { PawPrint, Users } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  petName: string;
  petPhoto: string | null;
  species: string;
  breed: string | null;
  followersCount: number;
}

export function PetProfilePreview({ children, petName, petPhoto, species, breed, followersCount }: Props) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={petPhoto ?? undefined} alt={petName} />
            <AvatarFallback><PawPrint className="h-5 w-5" /></AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{petName}</p>
            <p className="text-xs text-muted-foreground capitalize">{breed ? `${breed} · ${species}` : species}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{followersCount} follower{followersCount !== 1 ? "s" : ""}</span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
