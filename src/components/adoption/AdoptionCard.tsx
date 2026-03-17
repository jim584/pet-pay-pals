import { useState } from "react";
import type { AdoptionListing } from "@/lib/adoption-api";
import { markAsAdopted } from "@/lib/adoption-api";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Globe, PawPrint, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function AdoptionCard({ listing }: { listing: AdoptionListing }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [marking, setMarking] = useState(false);
  const isOwner = user?.id === listing.posted_by;
  const photo = listing.photo_urls?.[0];

  const handleMarkAdopted = async () => {
    setMarking(true);
    try {
      await markAsAdopted(listing.id);
      toast.success(`${listing.pet_name} has been marked as adopted! 🎉`);
      queryClient.invalidateQueries({ queryKey: ["adoption-listings"] });
    } catch {
      toast.error("Failed to update listing");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {photo ? (
        <div className="aspect-[4/3] overflow-hidden">
          <img src={photo} alt={listing.pet_name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-muted flex items-center justify-center">
          <PawPrint className="h-16 w-16 text-muted-foreground/30" />
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-lg font-bold font-display text-foreground">{listing.pet_name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Badge variant="secondary" className="capitalize">{listing.species}</Badge>
            {listing.breed && <Badge variant="outline">{listing.breed}</Badge>}
            {listing.age_text && <Badge variant="outline">{listing.age_text}</Badge>}
            {listing.gender && <Badge variant="outline" className="capitalize">{listing.gender}</Badge>}
          </div>
        </div>

        {listing.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{listing.description}</p>
        )}

        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
          <p className="font-semibold text-foreground">{listing.shelter_name}</p>
          {listing.shelter_location && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {listing.shelter_location}
            </p>
          )}
          {listing.contact_phone && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" /> {listing.contact_phone}
            </p>
          )}
          {listing.contact_email && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" /> {listing.contact_email}
            </p>
          )}
          {listing.contact_website && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" /> {listing.contact_website}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {(listing.contact_phone || listing.contact_email) && (
            <Button className="w-full" asChild>
              <a href={listing.contact_phone ? `tel:${listing.contact_phone}` : `mailto:${listing.contact_email}`}>
                Contact Shelter
              </a>
            </Button>
          )}

          {isOwner && !listing.is_adopted && (
            <Button
              variant="outline"
              className="w-full gap-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
              onClick={handleMarkAdopted}
              disabled={marking}
            >
              <CheckCircle2 className="h-4 w-4" />
              {marking ? "Updating..." : "Mark as Adopted"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
