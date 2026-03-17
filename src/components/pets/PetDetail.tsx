import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { Pet, HealthRecord, EmergencyContact, fetchHealthRecords, fetchEmergencyContacts, deleteHealthRecord, deleteEmergencyContact, formatAge } from "@/lib/pets-api";
import { AddHealthRecordDialog } from "./AddHealthRecordDialog";
import { AddEmergencyContactDialog } from "./AddEmergencyContactDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PawPrint, Plus, Trash2, Calendar, Stethoscope, Phone, ArrowLeft, Pencil, Cake, PartyPopper } from "lucide-react";

interface PetDetailProps {
  pet: Pet;
  onBack: () => void;
  onEdit: () => void;
}

export function PetDetail({ pet, onBack, onEdit }: PetDetailProps) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [editRecord, setEditRecord] = useState<HealthRecord | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<EmergencyContact | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);

  const loadRecords = () => fetchHealthRecords(pet.id).then(setRecords).catch(() => {});
  const loadContacts = () => fetchEmergencyContacts(pet.id).then(setContacts).catch(() => {});

  useEffect(() => {
    loadRecords();
    loadContacts();
  }, [pet.id]);

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    try {
      await deleteHealthRecord(recordToDelete);
      toast.success("Record deleted");
      loadRecords();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecordToDelete(null);
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;
    try {
      await deleteEmergencyContact(contactToDelete);
      toast.success("Contact deleted");
      loadContacts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setContactToDelete(null);
    }
  };

  const recordTypeColors: Record<string, string> = {
    vaccination: "bg-accent text-accent-foreground",
    surgery: "bg-destructive text-destructive-foreground",
    checkup: "bg-primary text-primary-foreground",
    allergy: "bg-destructive/80 text-destructive-foreground",
    medication: "bg-secondary text-secondary-foreground",
    general: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-14 w-14 border-2 border-primary/20">
          <AvatarImage src={pet.photo_url ?? undefined} alt={pet.name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            <PawPrint className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-2xl font-bold font-display">{pet.name}</h2>
          <p className="text-muted-foreground capitalize">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
        </div>
        <Button variant="outline" onClick={onEdit}>Edit</Button>
      </div>

      {/* Pet Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Age", value: formatAge(pet) },
          { label: "Weight", value: pet.weight_kg ? `${pet.weight_kg} lbs` : "—" },
          { label: "Species", value: pet.species },
          { label: "Breed", value: pet.breed || "—" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-lg font-semibold capitalize mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Birthday Countdown */}
      {pet.date_of_birth && (() => {
        const today = new Date();
        const birth = new Date(pet.date_of_birth + "T00:00:00");
        const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (nextBirthday.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
          nextBirthday.setFullYear(today.getFullYear() + 1);
        }
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const daysUntil = Math.round((nextBirthday.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
        const isToday = daysUntil === 0;

        return (
          <Card className={isToday ? "border-primary bg-primary/5" : "border-accent"}>
            <CardContent className="p-4 flex items-center gap-3">
              {isToday ? (
                <PartyPopper className="h-8 w-8 text-primary shrink-0" />
              ) : (
                <Cake className="h-8 w-8 text-accent-foreground/60 shrink-0" />
              )}
              <div>
                {isToday ? (
                  <>
                    <p className="font-bold font-display text-primary">🎉 Happy Birthday, {pet.name}!</p>
                    <p className="text-sm text-muted-foreground">
                      Born {birth.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold font-display">
                      {daysUntil === 1 ? "Birthday tomorrow! 🎂" : `Birthday in ${daysUntil} days`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextBirthday.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {pet.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{pet.notes}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Health Records */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-display flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" /> Health Records
          </h3>
          <Button size="sm" onClick={() => { setEditRecord(null); setShowAddRecord(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No health records yet.</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.title}</span>
                      <Badge className={recordTypeColors[r.record_type] || recordTypeColors.general} variant="secondary">
                        {r.record_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.record_date}</span>
                      {r.vet_name && <span>Dr. {r.vet_name}</span>}
                    </div>
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={(e) => { e.stopPropagation(); setEditRecord(r); setShowAddRecord(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); setRecordToDelete(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Emergency Contacts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-display flex items-center gap-2">
            <Phone className="h-5 w-5 text-accent" /> Emergency Contacts
          </h3>
          <Button size="sm" onClick={() => { setEditContact(null); setShowAddContact(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emergency contacts yet.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.contact_name}</p>
                    <p className="text-sm text-muted-foreground">{c.phone}{c.relationship ? ` · ${c.relationship}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={(e) => { e.stopPropagation(); setEditContact(c); setShowAddContact(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); setContactToDelete(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddHealthRecordDialog open={showAddRecord} onOpenChange={(open) => { setShowAddRecord(open); if (!open) setEditRecord(null); }} petId={pet.id} onSuccess={loadRecords} record={editRecord} />
      <AddEmergencyContactDialog open={showAddContact} onOpenChange={(open) => { setShowAddContact(open); if (!open) setEditContact(null); }} petId={pet.id} onSuccess={loadContacts} contact={editContact} />

      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => { if (!open) setRecordToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete health record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this health record. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => { if (!open) setContactToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete emergency contact?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this emergency contact. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContact} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
